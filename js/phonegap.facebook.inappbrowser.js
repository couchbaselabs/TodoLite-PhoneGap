// via https://github.com/caiovaccaro/phonegap.facebook.inappbrowser
;(function() {

    FacebookInAppBrowser = {

        settings: {
          appId: '',
          redirectUrl: '',
          permissions: ''
        }

        , login: function(successCallback) {

            if(this.settings.appId === '' || this.settings.redirectUrl === '') {
              console.log('[FacebookInAppBrowser] You need to set up your app id and redirect url.');
              return false;
            }

            var authorize_url  = "https://m.facebook.com/dialog/oauth?";
                authorize_url += "client_id=" + this.settings.appId;
                authorize_url += "&redirect_uri=" + this.settings.redirectUrl;
                authorize_url += "&display=touch";
                authorize_url += "&response_type=token";
                authorize_url += "&type=user_agent";

                if(this.settings.permissions !== '') {
                  authorize_url += "&scope=" + this.settings.permissions;
                }

            var faceView, workaround = false, access_token = null, redirectUrl = this.settings.redirectUrl;
                callback = function(location) {
                  console.log("[FacebookInAppBrowser] Event 'loadstart': " + JSON.stringify(location));

                  if (location.url.indexOf("https://m./") == 0) {
                    // workaround for facebook bug introduced 8/27
                    var newLoc = location.url.replace("https://m./", "https://m.facebook.com/")
                    console.log("[FacebookInAppBrowser] workaround goto "+newLoc)
                    // faceView.executeScript({code : 'window.location = "'+newLoc+'"'})
                    workaround = true;
                    faceView.close()
                    faceView = window.open(newLoc, '_blank', 'location=no');
                    faceView.addEventListener('loadstart', callback);
                    faceView.addEventListener('exit', onExit);
                  }

                  if (location.url.indexOf("access_token") !== -1) {
                    // Success
                    access_token = location.url.match(/access_token=(.*)$/)[1].split('&expires_in')[0];
                    console.log("[FacebookInAppBrowser] Logged in. Token: " + access_token);
                    faceView.close();

                    successCallback(false, access_token);
                  }

                  if (location.url.indexOf("error_reason=user_denied") !== -1) {
                    // User denied
                    userDenied = true;
                    console.log('[FacebookInAppBrowser] User denied Facebook Login.');
                    successCallback({reason : "User denied Facebook Login."});
                    faceView.close();
                  }
                },
                onExit = function() {
                  if (workaround) {
                    workaround = false
                    return;
                  }
                  if(access_token === null && userDenied === false) {
                    // InAppBrowser was closed and we don't have an app id
                    successCallback({reason : "Not logged into Facebook."});

                  }

                  userDenied = false;

                },
                userDenied = false;

            faceView = window.open(authorize_url, '_blank', 'location=no');
            faceView.addEventListener('loadstart', callback);
            faceView.addEventListener('exit', onExit);



        }

        , invite: function(inviteText, successCallback, errorCallback) {

            if(typeof inviteText === 'undefined') {
              console.log('[FacebookInAppBrowser] inviteText is a required parameter.');
              return false;
            }

            var obj = this;

            var request_url  = "https://m.facebook.com/dialog/apprequests?";
                request_url += "app_id=" + this.settings.appId;
                request_url += "&redirect_uri=" + this.settings.redirectUrl;
                request_url += "&display=touch";
                request_url += "&message=" + inviteText;

                request_url = encodeURI(request_url);

            console.log('[FacebookInAppBrowser] Invite, URL: ' + request_url);

            var faceView,
                callback = function(location) {
                   console.log("[FacebookInAppBrowser] Event 'loadstart': " + JSON.stringify(location));

                   if(location.url == request_url) {

                      // Do nothing

                   } else if (location.url.indexOf("?request=") !== -1) {
                      // Success
                      faceView.close();

                      if(typeof successCallback !== 'undefined' && typeof successCallback === 'function') {
                        successCallback();
                      }

                   } else if(location.url.indexOf('error_code=') !== -1) {
                      // Error
                      faceView.close();

                      if(typeof errorCallback !== 'undefined' && typeof errorCallback === 'function') {
                        errorCallback();
                      }

                   } else if(location.url === obj.settings.redirectUrl + '#_=_') {
                      // User clicked Cancel
                      face.close();

                   }

                };

            faceView = window.open(request_url, '_blank', 'location=no');
            faceView.addEventListener('loadstart', callback);

        }

        , logout: function(access_token, afterCallback) {

            var logout_url = encodeURI("https://www.facebook.com/logout.php?next="  + this.settings.redirectUrl + "&access_token=" + access_token);
            var obj = this;

            var face = window.open(logout_url, '_blank', 'hidden=yes,location=no'),
                callback = function(location) {
                   console.log("[FacebookInAppBrowser] Event 'loadstart': " + JSON.stringify(location));

                   if(location.url == logout_url) {

                      // Do nothing

                   } else if(location.url ===  obj.settings.redirectUrl + '#_=_' || location.url === obj.settings.redirectUrl) {

                      face.close();

                      if(typeof afterCallback !== 'undefined' && typeof afterCallback === 'function') {

                        afterCallback();

                      }

                   }

                };

            face.addEventListener('loadstart', callback);

        }

    };

}).call(this);
