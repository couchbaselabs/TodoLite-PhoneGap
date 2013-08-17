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

function appInit() {
    getConfig(function(err, config){
        window.config = config
        console.log("config", config)
        appReady()
    })
};

window.dbChanged = function(){}

function appReady() {
    config.db.changes(function(){
        window.dbChanged()
    })
    goIndex()
}

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

function goList(id) {
    config.db.get(id, function(err, doc){
        $("#content").html(config.t.list(doc))

        $("#content .todo-index").click(function(){
            goIndex()
        })

        $("#content .todo-share").click(function(){
            goShare(id)
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
            })
        }

        window.dbChanged()
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
                    done(false, {
                        user : user,
                        db : db,
                        views : views,
                        server : url,
                        t : t
                    })
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
