# Todo Lite

A shared todo list application to demonstrate the features of [Couchbase Lite](http://github.com/couchbase/mobile).

## Install

To run this application, you'll need the Xcode developer package, or the Android SDK, and the PhoneGap toolchain.

First create an empty PhoneGap app container using the [PhoneGap npm package](https://npmjs.org/package/phonegap).

```sh
npm install -g phonegap
phonegap create todo-lite com.couchbase.TodoLite TodoLite
cd todo-lite
```

Now install the PhoneGap plugins required to make it run. This activates Couchbase Lite, the camera, and the InAppBrowser.

```sh
phonegap local plugin add https://github.com/couchbaselabs/Couchbase-Lite-PhoneGap-Plugin.git
phonegap local plugin add https://git-wip-us.apache.org/repos/asf/cordova-plugin-camera.git
phonegap local plugin add org.apache.cordova.core.inappbrowser
```

Now replace the generated application with the Todo Lite source code.

```sh
rm -rf www
git clone https://github.com/couchbaselabs/TodoLite-PhoneGap.git www
```

That's it, now you are ready to run the app:

```sh
phonegap run ios
```

or

```sh
phonegap run android
```

This will launch the app in your iOS or Android Simulator. If you want to launch the app on an iOS device, open the project in Xcode. From the project directory, you can run:

```sh
open platforms/ios/TodoLite.xcodeproj/
```

Do note that the Xcode project is only updated by the `phonegap` command line tool, so you must run `phonegap run ios` or `phonegap build ios` before it will pick up any changes made in the `www` directory.

## Running your own Sync Gateway server

In `www/js/index.js` there is a value for `syncUrl` which is set to a remote server hosted by Couchbase as a convenience. You can easily provision your own server either by running your own instance of [Couchbase Sync Gateway](https://github.com/couchbase/sync_gateway) or by creating a server in [the experimental Couchbase cloud.](http://console.couchbasecloud.com/)

If you are running your own server, launch it by pointing it at the `sync-gateway-config.json` that is shipped as part of this repository. If you are launching a Sync Gateway instance in the cloud, the only configuration you'll need to provide is to copy the sync function from that JSON file into the web UI.

## Release Notes / TODO

* Currently support for Android is limited by a few minor API compatiblity issues. These are probably fixed by the time you are reading this.
* Redraw flash should be avoided. This is especially apparent on long lists.
* Lists are too wide in portrait mode on iPad
* The app won't detect if you get logged out (cookie expires) -- need testing.

## Community

If you got this far, please [join our mailing list](https://groups.google.com/forum/#!forum/mobile-couchbase) and let us know how it went. Or just [send a tweet.](https://twitter.com/intent/tweet?text=I'm%20using%20@Couchbase%20Lite%20with%20@PhoneGap)

