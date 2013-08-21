/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */


var coax = require("coax"),
    fastclick = require("fastclick"),
    appDbName = "todo"

new fastclick.FastClick(document.body)

document.addEventListener("deviceready", appInit, false)

/*
Initialize the app, connect to the database, draw the initial UI
*/

function appInit() {
    getConfig(function(){
        appReady()
    })
};

window.dbChanged = function(){}

function appReady() {
    var lastSeq;
    config.db.changes({since : config.info.update_seq}, function(_, ch){
        if (ch.seq == lastSeq) {return}
        lastSeq = ch.seq
        console.log("change", ch)
        window.dbChanged()
    })
    goIndex()
}

/*
The index UI lists the available todo lists and lets you create new ones.
*/

function goIndex() {
    $("#content").html(config.t.index())
    $("#content form").submit(function(e) {
        e.preventDefault()
        var doc = jsonform(this)
        doc.type = "list"
        doc.created_at = new Date()
        console.log(doc)
        config.db.post(doc, function(err, ok) {
            $("#content form input").val("")
        })
    })
    $("#scrollable").on("click", "li", function() {
        var id = $(this).attr("data-id");
        goList(id)
    })
    window.dbChanged = function() {
        config.views(["lists", {descending : true}], function(err, view) {
            console.log("lists", view)
            $("#scrollable").html(config.t.indexList(view))
        })
    }
    window.dbChanged()
}

/*
The list UI lets you create todo items and check them off or delete them.
It also links to a screen for sharing each list with a different set of friends.
*/

function goList(id) {
    config.db.get(id, function(err, doc){
        $("#content").html(config.t.list(doc))

        $("#content .todo-index").click(function(){
            goIndex()
        })

        $("#content .todo-share").click(function(){
            doShare(id)
        })

        $("#content form").submit(function(e) {
            e.preventDefault()
            var doc = jsonform(this)
            doc.type = "item"
            doc.listId = id
            doc.created_at = new Date()
            console.log(doc)
            config.db.post(doc, function(err, ok) {
                $("#content form input").val("")
            })
        })

        $("#scrollable").on("click", "li", function() {
            var id = $(this).attr("data-id");
            toggleChecked(id)
        })

        window.dbChanged = function() {
            config.views(["items", {
                startkey : [id, {}],
                endkey : [id],
                descending : true
            }], function(err, view) {
                console.log("items", view)
                $("#scrollable").html(config.t.listItems(view))
                $("#scrollable li").on("swipeRight", function() {
                    var id = $(this).attr("data-id")
                    $(this).find("button").show().click(function(){
                        deleteItem(id)
                        return false;
                    })
                })
            })
        }

        window.dbChanged()
    })
}

function deleteItem(id) {
    console.log("delete", id)
    config.db.get(id, function(err, doc){
        doc._deleted = true;
        config.db.put(id, doc, function(){})
    })
}

function toggleChecked(id) {
    console.log("toggle", id)
    config.db.get(id, function(err, doc){
        doc.checked = !doc.checked
        doc.created_at = new Date()
        config.db.put(id, doc, function(){})
    })
}

/*
The sharing and login management stuff
*/

function doShare(id) {
    if (!config.user) {
        doLogin(function(err) {
            console.log("login done", err, config.user)
        })
    }
}

/*
Login via Facebook
*/

function doLogin(cb) {
    doFacebook("http://REMOTEURL", function(err, data){
        if (err) {return cb(err)}
        doAfterFirstLogin(cb)
    })
}

function doAfterFirstLogin(cb) {
    addMyUsernameToAllLists(function(err) {
        if (err) {return cb(err)}
        triggerSync(cb)
    })
}

function doFacebook(remoteUrl, cb) {
    FacebookInAppBrowser.settings.appId = "501518809925546"
    FacebookInAppBrowser.settings.redirectUrl = 'http://console.couchbasecloud.com/index/'
    FacebookInAppBrowser.settings.permissions = 'email'
    FacebookInAppBrowser.login(function(accessToken){
        getEmailForFacebookUser(accessToken, function(err, data) {
            console.log("got facebook user info", data)
            data.remote_url = remoteUrl
            coax.post([config.server, "_facebook_token"], data, function(err, ok){
                if (err) {return cb(err)}
                setUser(data.email, cb)
            })
        })
    }, function(err) { // only called if we don't get an access token
        cb(err)
    })
}

function getEmailForFacebookUser(token, cb) {
    var url = "https://graph.facebook.com/me?fields=id,name,email&access_token="+token;
    coax.get(url, function(err, data) {
        if (err) {
            cb(err)
        } else {
            cb(false, {
                email : data.email,
                access_token : token
            })
        }
    })
}

/*
Sync Manager: this is run on first login, and on every app boot after that.
If it
*/

function triggerSync() {
    // if we get a 401 on sync, we do this and then retry
    // doFacebook("http://REMOTEURL", function(err, data){
    //     if (err) {return cb(err)}
    //     retrySync()
    // })
}

/*
The config functions don't have any visibile UI, they are used
for application bootstrap and then by later state. The result of
the config setup is stored in `window.config` for easy access.
*/

function getConfig(done) {
    // get CBL url
    if (!window.cblite) {
        return done('Couchbase Lite not installed')
    }

    var mustache = require("mustache"),
        t = {}

    $('script[type="text/mustache"]').each(function() {
        var id = this.id.split('-')
        id.pop()
        t[id.join('-')] = mustache.compile(this.innerHTML.replace(/^\s+|\s+$/g,''))
    });

    cblite.getURL(function(err, url) {
        if (err) {
            return done(err)
        }
        var db = coax([url, appDbName]);
        setupDb(db, function(err, info){
            if (err) {
                return done(err);
            }
            setupViews(db, function(err, views){
                getUser(db, function(_, user) {
                    window.config = {
                        user : user,
                        setUser : function(email, cb) {
                            if (window.config.user) {
                                return cb("user already set")
                            }
                            var newUser = {
                                email : email
                            }
                            db.put("_local/user", newUser, function(err, ok){
                                window.config.user = newUser
                                cb()
                            })
                        },
                        db : db,
                        info : info,
                        views : views,
                        server : url,
                        t : t
                    }
                    done(false)
                })
            })
        })
    })

    function setupDb(db, cb) {
        db.put(function(){
            db.get(cb)
        })
    }

    function setupViews(db, cb) {
        var design = "_design/todo5"
        db.put(design, {
            views : {
                lists : {
                    map : function(doc) {
                        if (doc.type == "list" && doc.created_at && doc.title) {
                            emit(doc.created_at, doc.title)
                        }
                    }.toString()
                },
                items : {
                    map : function(doc) {
                        if (doc.type == "item" && doc.created_at && doc.title && doc.listId) {
                            emit([doc.listId, !doc.checked, doc.created_at],
                                {checked : doc.checked ? "checked" : "", title : doc.title})
                        }
                    }.toString()
                }
            }
        }, function(){
            cb(false, db([design, "_view"]))
        })
    }

    function getUser(db, cb) {
        db.get("_local/user", function(err, doc) {
            var user = false;
            if (!err) {
                user = doc;
            }
            cb(false, user)
        })
    };
}

/*
Helpers that aren't in a node module and thus aren't in the `modules.js` file
*/

function jsonform(elem) {
  var o = {}, list = $(elem).serializeArray();
  for (var i = list.length - 1; i >= 0; i--) {
    var name = list[i].name, value = list[i].value;
    if (o[name]) {
        if (!o[name].push) {
            o[name] = [o[name]];
        }
        o[name].push(value);
    } else {
        o[name] = value;
    }
  };
  return o;
};
