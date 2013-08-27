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
    setupConfig(function(){
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
    if (config.user) {
        triggerSync(function(err) {
            if (err) {
                console.log("error on sync", err)
            }
        })
    }
}

/*
The index UI lists the available todo lists and lets you create new ones.
*/

function drawContent(html) {
    scroll(0,0)
    $("#content").html(html)
}

function goIndex() {
    drawContent(config.t.index())
    if (!config.user) {
        $(".todo-login").show().click(function(){
            doFirstLogin(function(err) {
                goIndex()
            })
        })
    }
    $("#content form").submit(function(e) {
        e.preventDefault()
        var doc = jsonform(this)
        doc.type = "list"
        doc.created_at = new Date()
        if (config.user && config.user.email) {
            doc.owner = config.user.email
        }
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
}

/*
The list UI lets you create todo items and check them off or delete them.
It also links to a screen for sharing each list with a different set of friends.
*/

function goList(id) {
    config.db.get(id, function(err, doc){
        drawContent(config.t.list(doc))

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
            config.db.post(doc, function(err, ok) {
                $("#content form input").val("")
            })
        })

        $("#scrollable").on("click", "li", function(e) {
            var id = $(this).attr("data-id")
            if ($(e.target).hasClass("camera")) {
                if ($(e.target).hasClass("image")) {
                    goImage(id)
                } else {
                    doCamera(id)
                }
            } else {
                toggleChecked(id)
            }
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

function doCamera(id) {
    console.log("camera", id)
    if (!(navigator.camera && navigator.camera.getPicture)) {return}

    navigator.camera.getPicture(function(imageData) {
        config.db(id, function(err, doc){
            doc._attachments = {
              "image.jpg" : {
                content_type : "image/jpg",
                data : imageData
              }
            }
            config.db.post(doc, function(err, ok) {})
        })
    }, function(message) { // onFail
        // alert('Failed because: ' + message);
    }, {
        quality: 50,
        targetWidth : 1000,
        targetHeight : 1000,
        destinationType: Camera.DestinationType.DATA_URL
    });
}

/*
Display a photo for an item if it exists.
*/

function goImage(id) {
    window.dbChanged = function(){}
    config.db(id, function(err, doc){
        doc.image_path = config.db([id,"image.jpg"]).pax.toString()
        drawContent(config.t.image(doc))
        $("#content .todo-image-back").click(function(){
            goList(doc.listId)
        })
        $("#content .todo-image-del").click(function(){
            delete doc.image_path
            delete doc._attachments["image.jpg"]
            config.db.post(doc, function(err, ok) {
                goList(doc.listId)
            })
        })
    })
}

/*
The sharing and login management stuff
*/

function doShare(id) {
    if (!config.user) {
        doFirstLogin(function(err) {
            console.log("login done", err, config.user)
            goShare(id)
        })
    } else {
        goShare(id)
    }
}

function goShare(id) {
    window.dbChanged = function(){}
    config.db(id, function(err, doc) {
        config.views("profiles", function(err, view){
            view.title = doc.title

            // fold over the view and mark members as checked
            var members = (doc.members || []).concat(doc.owner);

            for (var i = view.rows.length - 1; i >= 0; i--) {
                var row = view.rows[i]
                for (var j = members.length - 1; j >= 0; j--) {
                    var member = members[j]
                    console.log("row", row.value, member)
                    if (row.value == member) {
                        row.checked = "checked"
                    }
                };
            };

            drawContent(config.t.share(view))

            $("#content .todo-share-back").click(function(){
                goList(id)
            })

            $("#scrollable").on("click", "li", function() {
                var user = $(this).attr("data-id");
                if (user !== doc.owner) {
                    toggleShare(doc, user, function(){
                        goShare(id)
                    })
                } else {
                    goShare(id)
                }
            })
        })
    })
}

function toggleShare(doc, user, cb) {
    doc.members = doc.members || [];
    var i = doc.members.indexOf(user)
    if (i === -1) {
        doc.members.push(user)
    } else {
        doc.members.splice(i,1)
    }
    console.log("members", doc.members)
    config.db.post(doc, cb)
}

/*
Login and setup existing data for user account
*/

function doFirstLogin(cb) {
    doFacebook(function(err, data){
        if (err) {return cb(err)}
        config.setUser(data, function(err, ok){
            if (err) {return cb(err)}
            registerFacebookToken(function(err){
                if (err) {return cb(err)}
                createMyProfile(function(err){
                    addMyUsernameToAllLists(function(err) {
                        if (err) {return cb(err)}
                        triggerSync(cb)
                    })
                })
            })
        })
    })
}

function registerFacebookToken(cb) {
    var registerData = {
        remote_url : config.site.syncUrl,
        email : config.user.email,
        access_token : config.user.access_token
    }
    coax.post([config.server, "_facebook_token"], registerData, cb)
}

function addMyUsernameToAllLists(cb) {
    config.views(["lists", {include_docs : true}], function(err, view) {
        if (err) {return cb(err)}
        var docs = [];
        view.rows.forEach(function(row) {
            row.doc.owner = config.user.email
            docs.push(row.doc)
        })
        config.db.post("_bulk_docs", {docs:docs}, function(err, ok) {
            console.log("updated all docs", err, ok)
            cb(err, ok)
        })
    })
}

function createMyProfile(cb) {
    var profileData = JSON.parse(JSON.stringify(config.user))
    profileData.type = "profile"
    profileData.user = profileData.email
    config.db.put("profile:"+config.user.email, profileData, cb)
}

/*
Get user email address from Facebook, and access code to verify on Sync Gateway
*/


function doFacebook(cb) {
    // TODO should pull from config?
    FacebookInAppBrowser.settings.appId = "501518809925546"
    FacebookInAppBrowser.settings.redirectUrl = 'http://console.couchbasecloud.com/index/'
    FacebookInAppBrowser.settings.permissions = 'email'
    FacebookInAppBrowser.login(function(accessToken){
        getFacebookUserInfo(accessToken, function(err, data) {
            if (err) {return cb(err)}
            console.log("got facebook user info", data)
            cb(false, data)
        })
    }, function(err) { // only called if we don't get an access token
        cb(err)
    })
}

function getFacebookUserInfo(token, cb) {
    var url = "https://graph.facebook.com/me?fields=id,name,email&access_token="+token
    coax.get(url, function(err, data) {
        if (err) {return cb(err)}
        data.access_token = token
        cb(false, data)
    })
}

function getNewFacebookToken(cb) {
    alert("getNewFacebookToken")
    // should be like doFirstLogin() but modify the user and
    // doesn't need to put the owner on all the lists.
    cb()
}

/*
Sync Manager: this is run on first login, and on every app boot after that.

The way it works is with an initial single push replication. When that
completes, we know we have a valid connection, so we can trigger a continuous
push and pull

*/

function triggerSync(cb) {
    var remote = {
        url : config.site.syncUrl,
        auth : {facebook : {email : config.user.email}}
    },
    push = {
        source : appDbName,
        target : remote,
        continuous : true
    }, pull = {
        target : appDbName,
        source : remote,
        continuous : true
    },
    retryCount = 3,

    pushSync = syncManager(config.server, push),
    pullSync = syncManager(config.server, pull)

    console.log("pushSync", push)

    pushSync.on("auth-challenge", function() {
        pushSync.cancel(function(err, ok) {
            if (err) {return}
            if (retryCount == 0) {return cb("sync retry limit reached")}
            retryCount--
            getNewFacebookToken(function(err, ok) {
                pushSync.start()
            })
       })
    })
    pushSync.on("error", function(err){
        cb(err)
    })
    pushSync.on("connected", function(){
        pullSync.start()
    })
    pullSync.on("error", function(err){
        cb(err)
    })
    pullSync.on("connected", function(){
        cb()
    })
    // setTimeout(function(){
        pushSync.start()
    // }, 10000)
}

/*
The config functions don't have any visibile UI, they are used
for application bootstrap and then by later state. The result of
the config setup is stored in `window.config` for easy access.
*/

function setupConfig(done) {
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
        if (err) {return done(err)}
        var db = coax([url, appDbName]);
        setupDb(db, function(err, info){
            if (err) {return done(err)}
            setupViews(db, function(err, views){
                if (err) {return done(err)}
                getUser(db, function(err, user) {
                    if (err) {return done(err)}
                    window.config = {
                        site : {
                            // syncUrl : "http://sync.couchbasecloud.com:4984/todos"
                            syncUrl : "http://mineral.local:4984/todos"
                        },
                        user : user,
                        setUser : function(newUser, cb) {
                            if (window.config.user) {
                                return cb("user already set")
                            }
                            db.put("_local/user", newUser, function(err, ok){
                                if (err) {return cb(err)}
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
                    if (window.config.user) {
                        registerFacebookToken(done)
                    } else {
                        done(false)
                    }
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
        var design = "_design/todo7"
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
                                {
                                    checked : doc.checked ? "checked" : "",
                                    title : doc.title,
                                    image : (doc._attachments && doc._attachments["image.jpg"])
                                })
                        }
                    }.toString()
                },
                profiles : {
                    map : function(doc){
                        if (doc.type == "profile" && doc.user && doc.name) {
                            emit(doc.name, doc.user)
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

/*
Sync manager module TODO extract to NPM
*/

function syncManager(serverUrl, syncDefinition) {
    var handlers = {}

    function callHandlers(name, data) {
        (handlers[name]||[]).forEach(function(h){
            h(data)
        })
    }

    function doCancelPost(cb) {
        var cancelDef = JSON.parse(JSON.stringify(syncDefinition))
        cancelDef.cancel = true
        coax.post([serverUrl, "_replicate"], cancelDef, function(err, info){
            if (err) {
                callHandlers("error", err)
                if (cb) {cb(err, info)}
            } else {
                callHandlers("cancelled", info)
                if (cb) {cb(err, info)}
            }
        })
    }

    function doStartPost() {
        var tooLate;
        function pollForStatus(info, wait) {
            if (wait) {
                setTimeout(function() {
                    tooLate = true
                }, wait)
            }
            processTaskInfo(info.session_id, function(done){
                if (!done && !tooLate) {
                    setTimeout(function() {
                        pollForStatus(info)
                    }, 200)
                } else if (tooLate) {
                    callHandlers("error", "timeout")
                }
            })
        }

        var callBack;
        if (syncDefinition.continuous) {
            // auth errors not detected for continuous sync
            // we could use _active_tasks?feed=continuous for this
            // but we don't need that code for this app...
            callBack = function(err, info) {
                console.log("continuous sync callBack", err, info, syncDefinition)
                if (err) {
                    callHandlers("error", err)
                } else {
                    pollForStatus(info, 10000)
                    callHandlers("started", info)
                }
            }
        } else { // non-continuous
            callBack = function(err, info) {
                console.log("sync callBack", err, info, syncDefinition)
                if (err) {
                    if (info.status == 401) {
                        err.status = info.status;
                        callHandlers("auth-challenge", err)
                    } else {
                        err.status = info.status;
                        callHandlers("error", err)
                    }
                } else {
                    callHandlers("connected", info)
                }

            }
        }
        console.log("start sync", syncDefinition)
        coax.post([serverUrl, "_replicate"], syncDefinition, callBack)
    }

    function processTaskInfo(id, cb) {
        taskInfo(id, function(err, task) {
            console.log("task", task)
            publicAPI.task = task
            if (task.error && task.error[0] == 401) {
                cb(true)
                callHandlers("auth-challenge", {status : 401, error : task.error[1]})
            } else if (task.status == "Idle" || task.status == "Stopped" || (/Processed/.test(task.status) && !/Processed 0/.test(task.status))) {
                cb(true)
                callHandlers("connected", task)
            } else if (/Processed 0 \/ 0 changes/.test(task.status)) {
                cb(true) // I think we only get this if we are connected
                callHandlers("connected", task)
            } else {
                cb(false) // not done
            }
        })
    }

    function taskInfo(id, cb) {
        coax([serverUrl,"_active_tasks"], function(err, tasks) {
            var me;
            for (var i = tasks.length - 1; i >= 0; i--) {
                if (tasks[i].task == id) {
                    me = tasks[i]
                }
            }
            cb(false, me);
        })
    }

    var publicAPI = {
        start : doStartPost,
        cancel : doCancelPost,
        on : function(name, cb) {
            handlers[name] = handlers[name] || []
            handlers[name].push(cb)
        }
    }
    return publicAPI;
}
