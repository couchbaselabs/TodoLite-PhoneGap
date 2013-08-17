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
    appDbName = "todo";

document.addEventListener("deviceready", appInit, false);

function appInit() {
    getConfig(function(err, config){
        window.config = config;
        console.log("config", config)
        appReady();
    })
};

function appReady() {
    goIndex()
}


function goIndex() {

}


function getConfig(done) {
    // get CBL url
    if (!window.cblite) {
        return done('Couchbase Lite not installed')
    }
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
                        server : url
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
        var design = "_design/todo"
        db.put(design, {
            views : {
                lists : {
                    map : function(doc) {
                        if (doc.type == "list" && doc.created_at && doc.name) {
                            emit(doc.created_at, doc.title)
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


