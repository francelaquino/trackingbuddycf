"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require('firebase-admin');
const cors = require("cors");
const express = require('express');
var NodeGeocoder = require('node-geocoder');
admin.initializeApp(functions.config().firebase);
const router = express.Router();
const db = admin.database();
const app = express();
const rad = (x) => {
    return x * Math.PI / 180;
};
const getDistance = (lat1, long1, lat2, long2) => {
    let R = 6378137;
    let dLat = rad(lat2 - lat1);
    let dLong = rad(long2 - long1);
    let a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(rad(lat1)) * Math.cos(rad(lat2)) *
            Math.sin(dLong / 2) * Math.sin(dLong / 2);
    let c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    let d = R * c;
    return d;
};
const getGeoLocation = (latitude, longtitude) => __awaiter(this, void 0, void 0, function* () {
    let address = "";
    let options = {
        provider: 'google',
        httpAdapter: 'https',
        apiKey: 'AIzaSyCHZ-obEHL8TTP4_8vPfQKAyzvRrrlmi5Q',
        formatter: null
    };
    let geocoder = NodeGeocoder(options);
    yield geocoder.reverse({ lat: latitude, lon: longtitude })
        .then(function (response) {
        let add = JSON.parse(response);
        address = response[0].formattedAddress;
    })
        .catch(function (err) {
        address = "";
    });
    return address;
});
const processPlaceAlert = (lat1, lon1, address, userid, firstname) => __awaiter(this, void 0, void 0, function* () {
    let placeArriveNotify = [];
    let placeLeftNotify = [];
    let fcmtoken = "";
    let count = 0;
    let cnt = 0;
    return new Promise((resolve) => {
        db.ref("placealert/" + userid).once("value").then(function (snapshot) {
            return __awaiter(this, void 0, void 0, function* () {
                if (snapshot.numChildren() <= 0) {
                    resolve();
                }
                else {
                    count = snapshot.numChildren();
                    snapshot.forEach((childSnapshot) => {
                        let childPromise = new Promise((childResolve) => {
                            db.ref('users/' + childSnapshot.val().placeowner).once("value", function (fcmtokenSnapshot) {
                                return __awaiter(this, void 0, void 0, function* () {
                                    if (fcmtokenSnapshot.val() !== null) {
                                        fcmtoken = fcmtokenSnapshot.val().fcmtoken;
                                        if (childSnapshot.val().arrives === true) {
                                            let distance = getDistance(Number(lat1), Number(lon1), Number(childSnapshot.val().latitude), Number(childSnapshot.val().longitude));
                                            if (Number(distance) <= 200) {
                                                placeArriveNotify.push({
                                                    placeowner: childSnapshot.val().placeowner,
                                                    fcmtoken: fcmtoken,
                                                    placeid: childSnapshot.val().placeid,
                                                    latitude: childSnapshot.val().latitude,
                                                    longitude: childSnapshot.val().longitude,
                                                    userid: userid
                                                });
                                            }
                                        }
                                        if (childSnapshot.val().leaves === true) {
                                            placeLeftNotify.push({
                                                fcmtoken: fcmtoken,
                                                placeowner: childSnapshot.val().placeowner,
                                                placeid: childSnapshot.val().placeid,
                                                latitude: childSnapshot.val().latitude,
                                                longitude: childSnapshot.val().longitude,
                                                userid: userid
                                            });
                                        }
                                    }
                                    childResolve();
                                });
                            });
                        }).then(function () {
                            cnt++;
                            if (cnt >= count) {
                                resolve();
                            }
                        });
                    });
                }
            });
        });
    }).then(function () {
        return __awaiter(this, void 0, void 0, function* () {
            yield placeLeftNotify.forEach((place) => __awaiter(this, void 0, void 0, function* () {
                yield db.ref('placeshistory/' + place.placeowner + '/' + place.userid + '/' + place.placeid).once("value", function (leavedataSnapshot) {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (leavedataSnapshot.val() !== null) {
                            let distance = getDistance(Number(lat1), Number(lon1), Number(leavedataSnapshot.val().latitude), Number(leavedataSnapshot.val().longitude));
                            if (Number(distance) > 11) {
                                yield db.ref('places/' + place.placeowner + '/' + place.placeid).once("value", function (placeSnapshot) {
                                    return __awaiter(this, void 0, void 0, function* () {
                                        let alert = firstname + " leaves " + placeSnapshot.val().placename;
                                        yield db.ref('placeshistory/' + place.placeowner + '/' + place.userid + '/' + place.placeid).remove();
                                        let message = {
                                            notification: {
                                                body: alert
                                            }
                                        };
                                        let options = {
                                            priority: "high",
                                            sound: "default",
                                            timeToLive: 60 * 60 * 24
                                        };
                                        admin.messaging().sendToDevice(place.fcmtoken, message, options)
                                            .then(function (response) {
                                            console.log("");
                                        })
                                            .catch(function (error) {
                                            console.log("");
                                        });
                                    });
                                });
                            }
                        }
                    });
                });
            }));
            yield setTimeout(() => __awaiter(this, void 0, void 0, function* () {
                yield placeArriveNotify.forEach((place) => __awaiter(this, void 0, void 0, function* () {
                    yield db.ref('placeshistory/' + place.placeowner + '/' + place.userid + '/' + place.placeid).once("value", function (arrivedataSnapshot) {
                        return __awaiter(this, void 0, void 0, function* () {
                            if (arrivedataSnapshot.val() === null) {
                                yield db.ref('placeshistory/' + place.placeowner + '/' + place.userid + '/' + place.placeid).set({
                                    address: address,
                                    latitude: place.latitude,
                                    longitude: place.longitude,
                                    arrives: true,
                                    leaves: false,
                                    datearrived: Date.now()
                                });
                                yield db.ref('places/' + place.placeowner + '/' + place.placeid).once("value", function (placeSnapshot) {
                                    return __awaiter(this, void 0, void 0, function* () {
                                        let alert = firstname + " arrives " + placeSnapshot.val().placename;
                                        let message = {
                                            notification: {
                                                body: alert
                                            }
                                        };
                                        let options = {
                                            priority: "high",
                                            sound: "default",
                                            timeToLive: 60 * 60 * 24
                                        };
                                        admin.messaging().sendToDevice(place.fcmtoken, message, options)
                                            .then(function (response) {
                                            console.log("");
                                        })
                                            .catch(function (error) {
                                            console.log("");
                                        });
                                    });
                                });
                            }
                        });
                    });
                }));
            }), 3000);
        });
    });
});
const saveLocation = (lat1, lon1, address, userid, dateadded) => __awaiter(this, void 0, void 0, function* () {
    let lat2 = "";
    let lon2 = "";
    yield db.ref("users/" + userid).once("value").then(function (snapshot) {
        if (snapshot.val() !== null && snapshot.val().latitude !== undefined && snapshot.val().longitude !== undefined) {
            lat2 = snapshot.val().latitude;
            lon2 = snapshot.val().longitude;
        }
    });
    if (lat2 == "" || lon2 == "" || lat2 == undefined || lon2 == undefined) {
        yield db.ref('locations/' + userid).push({
            lat: lat1,
            lon: lon1,
            address: address,
            dateadded: dateadded
        });
        yield db.ref("users").child(userid).update({
            address: address,
            latitude: lat1,
            longitude: lon1,
            lastmovement: dateadded
        });
        yield db.ref("memberof/" + userid).once("value").then(function (snapshot) {
            snapshot.forEach((userSnap) => {
                if (userSnap.val().userid !== userid) {
                    db.ref("users/" + userSnap.val().userid + "/members/" + userid).set({
                        lastmovement: Date.now(),
                        userid: userid
                    });
                }
            });
        });
    }
    else {
        let distance = yield getDistance(Number(lat1), Number(lon1), Number(lat2), Number(lon2));
        if (Number(distance) >= 300) {
            yield db.ref('locations/' + userid).push({
                lat: lat1,
                lon: lon1,
                address: address,
                dateadded: dateadded
            });
            yield db.ref("users").child(userid).update({
                address: address,
                latitude: lat1,
                longitude: lon1,
                lastmovement: dateadded
            });
            yield db.ref("memberof/" + userid).once("value").then(function (snapshot) {
                snapshot.forEach((userSnap) => {
                    if (userSnap.val().userid !== userid) {
                        db.ref("users/" + userSnap.val().userid + "/members/" + userid).set({
                            lastmovement: Date.now(),
                            userid: userid
                        });
                    }
                });
            });
        }
    }
});
app.get('/appendLocation', function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        let lat1 = req.query.lat;
        let lon1 = req.query.lon;
        let userid = req.query.userid;
        let dateadded = req.query.dateadded;
        let firstname = req.query.firstname;
        let address = "";
        let options = {
            provider: 'google',
            httpAdapter: 'https',
            apiKey: 'AIzaSyCHZ-obEHL8TTP4_8vPfQKAyzvRrrlmi5Q',
            formatter: null
        };
        let geocoder = NodeGeocoder(options);
        yield geocoder.reverse({ lat: lat1, lon: lon1 })
            .then(function (response) {
            return __awaiter(this, void 0, void 0, function* () {
                address = response[0].formattedAddress;
                yield processPlaceAlert(lat1, lon1, address, userid, firstname);
                yield saveLocation(lat1, lon1, address, userid, dateadded);
            });
        })
            .catch(function (err) {
            address = "";
        });
        res.send("updated");
    });
});
app.get('/sendNotification', function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        let token = req.query.token;
        let message = {
            notification: {
                title: "Places Movement",
                body: "This is the body of the notification message."
            }
        };
        let options = {
            priority: "high",
            sound: "default",
            timeToLive: 60 * 60 * 24
        };
        //admin.messaging().send(message)
        admin.messaging().sendToDevice(token, message, options)
            .then(function (response) {
            console.log("Successfully sent message:", response);
        })
            .catch(function (error) {
            console.log("Error sending message:", error);
        });
        res.send("Location saved");
    });
});
app.get('/getLastLocation', function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        var options = {
            provider: 'google',
            // Optional depending on the providers
            httpAdapter: 'https',
            apiKey: 'AIzaSyCHZ-obEHL8TTP4_8vPfQKAyzvRrrlmi5Q',
            formatter: null // 'gpx', 'string', ...
        };
        var geocoder = NodeGeocoder(options);
        geocoder.reverse({ lat: 45.767, lon: 4.833 })
            .then(function (response) {
            console.log(response);
            res.send(response);
        })
            .catch(function (err) {
            console.log(err);
        });
        res.send("Done");
    });
});
const api = functions.https.onRequest(app);
module.exports = {
    api
};
//# sourceMappingURL=index.js.map