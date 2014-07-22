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

document.addEventListener("deviceready", onDeviceReady, false)

// var REMOTE_SYNC_URL = "http://10.0.1.12:4984/todos/"
// var REMOTE_SYNC_URL = "http://sync.couchbasecloud.com:4984/todos4"
var REMOTE_SYNC_URL = "http://couchbase.triskaideca.com:4984/todos"

var REMOTE_SYNC_PROTOCOL = "http://"
var REMOTE_SYNC_SERVER = "couchbase.triskaideca.com"
//var REMOTE_SYNC_SERVER = "sync.couchbasecloud.com"
var REMOTE_SYNC_PORT = "4984"
//var REMOTE_SYNC_DATABASE = "todolite-phonegap"
var REMOTE_SYNC_DATABASE = "todos"
var REMOTE_SERVER_LOGIN_URL = "http://couchbase.triskaideca.com/todologin"
var REMOTE_SERVER_LOGOUT_URL = "http://couchbase.triskaideca.com/todologout"
	
var SERVER_LOGIN = true
var FACEBOOK_LOGIN = false

/*
Initialize the app, connect to the database, draw the initial UI
*/

// run on device ready, call setupConfig kick off application logic
// with appReady.

function onDeviceReady() {
    setupConfig(function(err){
        if (err) {
            alert(err)
            return console.log("err "+JSON.stringify(err))
        }
        connectToChanges()
        goIndex()
        config.syncReference = triggerSync(function(err) {
            if (err) {console.log("error on sync"+ JSON.stringify(err))}
        })
    })
};

// function placeholder replaced by whatever should be running when the
// change comes in. Used to trigger display updates.
window.dbChanged = function(){}

// call window.dbChanged each time the database changes. Use it to
// update the display when local or remote updates happen.
function connectToChanges() {
  config.db.changes({since : config.info.update_seq}, function(err, change){
      lastSeq = change.seq
      log("change", err, change)
      window.dbChanged()
  })
}

/*
Error handling UI
*/

function loginErr(err) {
    if (err.reason) {
        alert("Can't login: "+err.reason);
    } else {
        alert("Login error: "+JSON.stringify(err))
    }
}

function logoutError(error) {
    if (error.reason) {
        alert( "Can't Logout: " + error.reason )
    } else {
        alert( "Logout Error: " + JSON.stringify( error ) )
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
    $("#content form").submit(function(e) {
        e.preventDefault()
        var doc = jsonform(this)
        doc.type = "list"
        doc.created_at = new Date()
        if (config.user && config.user.email) {
            // the the device owner owns lists they create
            doc.owner = "p:"+config.user.user_id
        }
        config.db.post(doc, function(err, ok) {
            $("#content form input").val("")
        })
    })
    // If you click a list,
    $("#scrollable").on("click", "li", function() {
        var id = $(this).attr("data-id");
        goList(id)
    })
    
    setLoginLogoutButton();
    
    // when the database changes, update the UI to reflect new lists
    window.dbChanged = function() {
        config.views(["lists", {descending : true}], function(err, view) {
            log("lists", view)
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
 * This is a function that defines the login and logout button
 */

function setLoginLogoutButton() {
    // offer the sign in screen to logged out users
    if (!config.user) {
    	if( SERVER_LOGIN ) {
    		$( ".todo-login" ).show().click( function() {
				goServerLogin();
			} )
    	} else if( FACEBOOK_LOGIN ) {
    		$( ".todo-login" ).show().click( function() {
                doFirstLogin( function(error) {
                    if (error) { return loginErr( error ) }
                    goIndex()
                } )
            } )
    	}
    } else {
    	if( SERVER_LOGIN ) {
			$( ".todo-login" ).show().click( function() {
				doServerLogout( function(error, data) {
					if (error) {
						if (error.reason) {
							alert( "Can not Logout: " + error.reason )
						} else {
							alert( "Logout Error: " + JSON.stringify( error ) )
						}
					}
					// Logout Success
					alert( "You are now logged out!" )
					$( ".todo-login" ).off( "click" )
					setLoginLogoutButton()
				} )
			} )
    	} else if( FACEBOOK_LOGIN ) {
	        $( ".todo-login" ).show().click( function() {
	            if (config.user.access_token) {
	                doFacebookLogout( config.user.access_token, function(error, data) {
	                    if (error) { return logoutError( error ) }
	                    $( ".todo-login" ).off( "click" );
	                    // Logout Success
	                    alert( "You are now logged out!" );
	                    setLoginLogoutButton()
	                } )
	            } else {
	                setLoginLogoutButton();
	            }
	        } )
    	}
    }
}

/*
 * The list UI lets you create todo tasks and check them off or delete them. It
 * also links to a screen for sharing each list with a different set of friends.
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
            doc.type = "task"
            doc.list_id = id
            doc.updated_at = doc.created_at = new Date()
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
            config.views(["tasks", {
                startkey : [id, {}],
                endkey : [id],
                descending : true
            }], function(err, view) {
                log("tasks", view)
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
    log("delete", id)
    config.db.get(id, function(err, doc){
        doc._deleted = true;
        config.db.put(id, doc, function(){})
    })
}

function toggleChecked(id) {
    log("toggle", id)
    config.db.get(id, function(err, doc){
        doc.checked = !doc.checked
        doc.updated_at = new Date()
        config.db.put(id, doc, function(){})
    })
}

function doCamera(id) {
    log("camera", id)
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
    }, {
        quality: 50,
        targetWidth : 1000,
        targetHeight : 1000,
        destinationType: Camera.DestinationType.DATA_URL
    });
}

/*
Display a photo for an task if it exists.
*/

function goImage(id) {
    window.dbChanged = function(){}
    config.db(id, function(err, doc){
        doc.image_path = config.db([id,"image.jpg"]).pax.toString()
        drawContent(config.t.image(doc))
        $("#content .todo-image-back").click(function(){
            goList(doc.list_id)
        })
        $("#content .todo-image-del").click(function(){
            delete doc.image_path
            delete doc._attachments["image.jpg"]
            config.db.post(doc, function(err, ok) {
                goList(doc.list_id)
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
            if (err) {
                return loginErr(err)
            }
            log("login done", err, config.user)
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
                    log("row", row.id, member)
                    if (row.id == member) {
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
    log("members", doc.members)
    config.db.post(doc, cb)
}

/*
 * Display Server Login Page
 */

function goServerLogin() {
	drawContent( config.t.login() )
	$( "#content form" ).submit( function(e) {
		e.preventDefault()
		var doc = jsonform( this );
		config.user = {};
		config.user.name = doc.email;
		config.user.password = doc.password;
		doFirstLogin( function(error, result) {
			if (error) { return loginErr( error ) }
			$( "#content form input" ).val( "" ) // Clear Form
			// Login Success Go To Index
			$( ".todo-login" ).off( "click" )
			setLoginLogoutButton( function(error, result) {
				if (error) {
					alert( "Error: " + JSON.stringify( error ) )
				}
				log( "Set Login Logout Button Call Back Result: " + result )
			} )
			goIndex()
		} )
	} )
}

/*
Login and setup existing data for user account
*/

function doFirstLogin(cb) {
	if (SERVER_LOGIN) {
		doServerLogin( function(error, data) {
			if (error) { return cb( error ) }
			config.setUser( data, function(error, ok) {
				if (error) { return cb( error ) }
				config.syncReference = triggerSync( function(error, ok) {
					log( "triggerSync done " + JSON.stringify( error ) )
					cb( error, ok )
				} )
			} )
		} )
	} else if (FACEBOOK_LOGIN) {
	    doFacebook(function(err, data){
	        if (err) {return cb(err)}
	        config.setUser(data, function(err, ok){
	            if (err) {return cb(err)}
	            registerFacebookToken(function(err,ok){
	                log("registerFacebookToken done "+JSON.stringify(err))
	                if (err) {
	                    log("registerFacebookToken err "+JSON.stringify([err, ok]))
	                    return cb(err)
	                }
	                createMyProfile(function(err){
	                    log("createMyProfile done "+JSON.stringify(err))
	                    addMyUsernameToAllLists(function(err) {
	                        log("addMyUsernameToAllLists done "+JSON.stringify(err))
	                        if (err) {return cb(err)}
	                        config.syncReference = triggerSync(function(err, ok){
	                            log("triggerSync done "+JSON.stringify(err))
	                            cb(err, ok)
	                        })
	                    })
	                })
	            })
	        })
	    })
	}
}

/*
 * Custom Indirect Server Login 
 * parameters are REMOTE_SERVER_LOGIN_URL, username and password
 * result returned is set as user
 */

function doServerLogin( callBack ) {
	log( "Do Server Login" );
	// check for internet connection
	if (navigator && navigator.connection) {
		log( "connection " + navigator.connection.type )
		if (navigator.connection.type == "none") { return callBack( {
			reason : "No network connection"
		} ) }
	}
	if (config && config.user) {
		var url = REMOTE_SERVER_LOGIN_URL;
		var login = coax( url );
		var credentials = '{ "username" : "' + config.user.name + '", "password" : "' + config.user.password + '" }';
		log( "http " + url + " " + credentials )
		login.post( JSON.parse( credentials ), function(error, result) {
			if (error) { return callBack( error ) }
			log( "Server Login Result:" + JSON.stringify( result ) )
			callBack( false, result )
		} )
	} else {
		return callBack( {
			reason : "Configuration User is not Set!"
		} )
	}
}

/*
 * Custom Indirect Server Logout
 * Parameters REMOTE_SERVER_LOGOUT_URL
 * User is set to null and sync replication is canceled.
 */

function doServerLogout( callBack ) {
	log( "Do Server Logout" );
	// check for internet connection
	if (navigator && navigator.connection) {
		log( "connection " + navigator.connection.type )
		if (navigator.connection.type == "none") { 
			return callBack( {
				reason : "No network connection"
			} )
		}
	}
	var url = REMOTE_SERVER_LOGOUT_URL;
	coax.get( url, function(error, result) {
		config.user = null;
		log( "Server Logout Result:" + JSON.stringify(result) + " Error:" + error )
		if (error) { return callBack( error ) }
        config.setUser( null, function( error , ok ) {
        	log( "User is Set to Null" )
            if (error) { return callBack( error ) }
            config.syncReference.cancelSync( function ( error, ok ) {
            	log( "Sync Replication Canceled" )
                callBack( error , result )
            } )
        } )
	} )
}

/*
 * registerServer is called upon startup to log into the server.
 */

function registerServer(callBack) {
	log( "Resister Server SessionID" )
	doServerLogin( function(error, data) {
		if (error) { return callBack( error ) }
		config.setUser( data, function(error, ok) {
			if (error) { return callBack( error ) }
			config.syncReference = triggerSync( function(error, ok) {
				log( "triggerSync done " + JSON.stringify( error ) )
				callBack( error, ok )
			} )
		} )
	} )
}

function registerFacebookToken(cb) {
    var registerData = {
        remote_url : config.site.syncUrl,
        email : config.user.email,
        access_token : config.user.access_token
    }
    log("registerFacebookToken POST "+JSON.stringify(registerData))
    coax.post([config.server, "_facebook_token"], registerData, cb)
}

function addMyUsernameToAllLists(cb) {
    config.views(["lists", {include_docs : true}], function(err, view) {
        if (err) {return cb(err)}
        var docs = [];
        view.rows.forEach(function(row) {
            row.doc.owner = "p:"+config.user.user_id
            docs.push(row.doc)
        })
        config.db.post("_bulk_docs", {docs:docs}, function(err, ok) {
            log("updated all docs", err, ok)
            cb(err, ok)
        })
    })
}

function createMyProfile(cb) {
    log("createMyProfile user "+JSON.stringify(config.user))
    var profileData = JSON.parse(JSON.stringify(config.user))
    profileData.type = "profile"
    profileData.user_id = profileData.email
    delete profileData.email
    log("createMyProfile put "+JSON.stringify(profileData))
    //Check if Profile Document Exists
    config.db.get( "p:"+profileData.user_id, function( error, doc ){
        if ( error ) {
            // doc does not exists
            config.db.put("p:"+profileData.user_id, profileData, cb)
        } else {
            profileData = doc;
            config.db.put("p:"+profileData.user_id, profileData, cb)
        }
    })
}

/*
Get user email address from Facebook, and access code to verify on Sync Gateway
*/


function doFacebook(cb) {
    if (navigator && navigator.connection) {
        log("connection "+navigator.connection.type)
        if (navigator.connection.type == "none") {
            return cb({reason : "No network connection"})
        }
    }

    // TODO should pull from config?
    FacebookInAppBrowser.settings.appId = "501518809925546"
    FacebookInAppBrowser.settings.redirectUrl = 'http://console.couchbasecloud.com/index/'
    FacebookInAppBrowser.settings.permissions = 'email'
    FacebookInAppBrowser.login(function(err, accessToken){
        if (err) {return cb(err)}
        getFacebookUserInfo(accessToken, function(err, data) {
            if (err) {return cb(err)}
            log("got facebook user info", data)
            cb(false, data)
        })
    })
}

function doFacebookLogout(token, cb) {
    if (navigator && navigator.connection) {
        log( "connection " + navigator.connection.type )
        if (navigator.connection.type == "none") { return cb( {
            reason : "No network connection"
        } ) }
    }
    FacebookInAppBrowser.settings.appId = "501518809925546"
    FacebookInAppBrowser.settings.redirectUrl = 'http://console.couchbasecloud.com/index/'
    FacebookInAppBrowser.settings.permissions = 'email'
    FacebookInAppBrowser.logout( token, function( error, data ) {
        if (error) { return cb( error ) }
        config.user = null;
        log( "Logged out of facebook" )
        config.setUser( null, function( error , ok ) {
            if (error) { return cb( error ) }
            config.syncReference.cancelSync( function ( error, ok ) {
                cb( error , data )
            } )
        } )
    } )
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
    log("getNewFacebookToken")
    // should be like doFirstLogin() but modify the user and
    // doesn't need to put the owner on all the lists.

    doFacebook(function(err, data){
        if (err) {return cb(err)}
        config.setUser(data, function(err, ok){
            if (err) {return cb(err)}
            registerFacebookToken(cb)
        })
    })
}

/*
Sync Manager: this is run on first login, and on every app boot after that.

The way it works is with an initial single push replication. When that
completes, we know we have a valid connection, so we can trigger a continuous
push and pull

*/
var triggerSyncStarted = false;

function triggerSync(cb, retryCount) {

    if (!config.user) {
        return log("no user")
    } 
    
	if (SERVER_LOGIN) {
		var remote = { 
			url : REMOTE_SYNC_PROTOCOL + encodeURIComponent( config.user.name ) + ":" + encodeURIComponent( config.user.password ) + "@" + REMOTE_SYNC_SERVER + ":" + REMOTE_SYNC_PORT + "/" + REMOTE_SYNC_DATABASE + "/"
		};
	} else if (FACEBOOK_LOGIN) {
	    var remote = {
	        url : config.site.syncUrl,
	        auth : {facebook : {email : config.user.email}} // why is this email?
	    };
	}
	log (" Remote: " + JSON.stringify( remote ) )
    var push = {
        source : appDbName,
        target : remote,
        continuous : true
    }, pull = {
        target : appDbName,
        source : remote,
        continuous : true
    },

    pushSync = syncManager(config.server, push),
    pullSync = syncManager(config.server, pull)

    log("pushSync", push)

    if (typeof retryCount == "undefined") {
        retryCount = 3
    }

    var challenged = false;
    function authChallenge() {
        log ("authChallenge")
        if (challenged) {return}
        challenged = true;
        pushSync.cancel(function(err, ok) {
            pullSync.cancel(function(err, ok) {
                if (retryCount == 0) {return cb("sync retry limit reached")}
                retryCount--
				if (SERVER_LOGIN) {
					doServerLogin( function(err, result) {
						if (err) { return loginErr( err ) }
						config.setUser( result, function(err, ok) {
							if (err) { return loginErr( err ) }
							challenged = false;
							config.syncReference = triggerSync( cb, retryCount )
						} )
					} )
				} else if (FACEBOOK_LOGIN) {
	                if (config.user) {
	                    getNewFacebookToken(function(err, ok) {
	                        if (err) {
	                            return loginErr(err)
	                        }
	                        challenged = false;
	                        config.syncReference = triggerSync( cb, retryCount )
	                    })
	                }
				}
            })
        })
    }
    
    function cancelSync( callBack ) {
        pushSync.cancel(function(err, ok) {
            if (err) {return log("pushSync Cancel Error: " + JSON.stringify(err) ) }
            pullSync.cancel(function(err, ok) {
                if (err) {return log("pullSync Cancel Error: " + JSON.stringify(err) ) }
                callBack( err, ok )
            })
        })
    }

    pushSync.on("auth-challenge", authChallenge)
    pullSync.on("auth-challenge", authChallenge)

    pushSync.on("error", function(err){
        if (challenged) {return}
        cb(err)
    })
    pushSync.on("connected", function(){
        pullSync.start()
    })
    pullSync.on("error", function(err){
        if (challenged) {return}
        cb(err)
    })
    pullSync.on("connected", function(){
        cb()
    })

    //start pushSync only once
    if (!triggerSyncStarted) {
    	triggerSyncStarted = true;
    	pushSync.start()
    }
    
    var publicAPI = {
        cancelSync : cancelSync
    }
    return publicAPI;
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
        console.log("getURL: " + JSON.stringify([err, url]))
        if (err) {return done(err)}

        var xmlHttp = new XMLHttpRequest()
        xmlHttp.open( 'GET', url, false )
        xmlHttp.send( null )
        console.log( 'XMLHttpRequest get: ' +  xmlHttp.responseText )

        window.server = coax(url);
        var db = coax([url, appDbName]);
        setupDb(db, function(err, info){
            if (err) {return done(err)}
            setupViews(db, function(err, views){
                if (err) {return done(err)}
                getUser(db, function(err, user) {
                    if (err) {return done(err)}
                    window.config = {
                        site : {
                            syncUrl : REMOTE_SYNC_URL
                        },
                        user : user,
                        setUser : function(newUser, cb) {
                            if (!window.config.user && !newUser) {
                                db.get("_local/user", function(err, doc){
                                    if (err) {return cb(err)}
                                    doc._deleted = true;
                                    db.put("_local/user", doc , function(err, ok){
                                        if (err) {return cb(err)}
                                        log("deleted local user")
                                        cb()
                                    })
                                })
                            } else {
                            	if (SERVER_LOGIN) {
    								if (config.user.user_id) {
    									if (config.user.user_id !== newUser.username) {
    										return cb( "already logged in as " + config.user.name )
    									} else {
    										/* We Got a New Session */
    										log( "New Session setUser " + JSON.stringify( newUser ) )
    										config.user.sessionID = newUser.sessionID
    										config.user.name = newUser.username;
    										config.user.user_id = newUser.username;
    										config.user.email = newUser.username;
    										config.user.password = newUser.password;
    										db.put( "_local/user", config.user, function(err, ok) {
    											if (err) { return cb( err ) }
    											log( "updateUser ok: " + JSON.stringify( ok ) )
    											config.user._rev = ok.rev
    											cb()
    										} )
    									}
    								} else {
    									log( "Initialize setUser " + JSON.stringify( newUser ) )
    									config.user.sessionID = newUser.sessionID
    									config.user.name = newUser.username;
    									config.user.user_id = newUser.username;
    									config.user.email = newUser.username;
    									config.user.password = newUser.password;
    									db.put( "_local/user", config.user, function(err, ok) {
    										if (err) { return cb( err ) }
    										log( "setUser ok: " + JSON.stringify( ok ) )
    										config.user._rev = ok.rev
    										cb()
    									} )
    								}
    							} else if (FACEBOOK_LOGIN) {
	                                if (window.config.user) {
	                                    if (config.user.user_id !== newUser.email) {
	                                        return cb("already logged in as "+config.user.user_id)
	                                    } else {
	                                        // we got a new facebook token
	                                        config.user.access_token = newUser.access_token
	                                        db.put("_local/user", config.user, function(err, ok){
	                                            if (err) {return cb(err)}
	                                            log("updateUser ok")
	                                            config.user._rev = ok.rev
	                                            cb()
	                                        })
	                                    }
	                                } else {
	                                    newUser.user_id = newUser.email
	                                    log("setUser "+JSON.stringify(newUser))
	                                    db.put("_local/user", newUser, function(err, ok){
	                                        if (err) {return cb(err)}
	                                        log("setUser ok")
	                                        window.config.user = newUser
	                                        cb()
	                                    })
	                                }
    							}
                            }
                        },
                        db : db,
                        s : coax(url),
                        info : info,
                        views : views,
                        server : url,
                        t : t
                    }
                    if (window.config.user) {
                    	if (SERVER_LOGIN) {
							registerServer( done )
						} else if (FACEBOOK_LOGIN) {
							registerFacebookToken(done)
						}
                    } else {
                        done(false)
                    }
                })
            })
        })
    })

    function setupDb(db, cb) {
        db.get(function(err, res, body){
            console.log(JSON.stringify(["before create db put", err, res, body]))
            db.put(function(err, res, body){
                db.get(cb)
            })
        })
    }

    function setupViews(db, cb) {
        var design = "_design/todo9"
        db.put(design, {
            views : {
                lists : {
                    map : function(doc) {
                        if (doc.type == "list" && doc.created_at && doc.title) {
                            emit(doc.created_at, doc.title)
                        }
                    }.toString()
                },
                tasks : {
                    map : function(doc) {
                        if (doc.type == "task" && doc.created_at && doc.title && doc.list_id) {
                            emit([doc.list_id, doc.created_at],
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
                        if (doc.type == "profile" && doc.user_id && doc.name) {
                            emit(doc.name)
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

/* END APP */

/*
* Helpers that aren't in a node module and thus aren't in the `modules.js` file
*
*
*
*
*
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
                    }, 500)
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
                log("continuous sync callBack", err, info, syncDefinition)
                if (err) {
                    callHandlers("error", err)
                } else {
                    pollForStatus(info, 30000)
                    callHandlers("started", info)
                }
            }
        } else { // non-continuous
            callBack = function(err, info) {
                log("sync callBack", err, info, syncDefinition)
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
        log("start sync"+ JSON.stringify(syncDefinition))
        coax.post([serverUrl, "_replicate"], syncDefinition, callBack)
        // coax.post([serverUrl, "_replicator"], syncDefinition, callBack)
    }

    function processTaskInfo(id, cb) {
        taskInfo(id, function(err, task) {
            if (err) {return cb(err)}
            log("task", task)

            publicAPI.task = task
            if (task.error && task.error[0] == 401) {
                cb(true)
                callHandlers("auth-challenge", {status : 401, error : task.error[1]})
            } else if (task.error && task.error[0] == 502) {
                cb(true)
                callHandlers("auth-challenge", {status : 502, error : task.error[1]})
            } else if (task.status == "Idle" || task.status == "Stopped" || (/Processed/.test(task.status) && !/Processed 0/.test(task.status))) {
                cb(true)
                callHandlers("connected", task)
            } else if (/Processed 0 \/ 0 changes/.test(task.status)) {
                // cb(false) // keep polling? (or does this mean we are connected?)
                cb(true)
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


// pluggable logger
function log() {
    console.log.apply(console, arguments)
}
