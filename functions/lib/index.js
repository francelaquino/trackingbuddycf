"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const functions = require("firebase-functions");
const admin = require('firebase-admin');
admin.initializeApp(functions.config().firebase);
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
exports.saveLocation = functions.https.onRequest((request, response) => {
    const db = admin.database();
    let lat2 = "";
    let lon2 = "";
    let lat1 = request.query.lat;
    let lon1 = request.query.lon;
    let address = request.query.address;
    let userid = request.query.userid;
    let dateadded = request.query.dateadded;
    return new Promise((resolve, reject) => {
        db.ref("users/" + userid).once("value").then(function (snapshot) {
            if (snapshot.val() !== null && snapshot.val().latitude != undefined && snapshot.val().longitude != undefined) {
                lat2 = snapshot.val().latitude;
                lon2 = snapshot.val().longitude;
                resolve();
            }
            else {
                resolve();
            }
        });
    }).then(function () {
        if (lat2 === "" || lon2 === "" || lat2 == undefined || lon2 == undefined) {
            db.ref('locations/' + userid).push({
                lat: lat1,
                lon: lon1,
                address: address,
                dateadded: dateadded
            });
            db.ref("users").child(userid).update({
                address: address,
                latitude: lat1,
                longitude: lon1,
                lastmovement: dateadded
            });
        }
        else {
            let movement = getDistance(Number(lat1), Number(lon1), Number(lat2), Number(lon2));
            if (movement >= 10) {
                db.ref('locations/' + userid).push({
                    lat: lat1,
                    lon: lon1,
                    address: address,
                    dateadded: dateadded
                });
                db.ref("users").child(userid).update({
                    address: address,
                    latitude: lat1,
                    longitude: lon1,
                    lastmovement: dateadded
                });
            }
        }
        response.send("Location saved");
    });
});
exports.getLastLocation = functions.https.onRequest((request, response) => {
    let db = admin.database();
    let lat2 = "";
    let lon2 = "";
    return new Promise((resolve, reject) => {
        db.ref("memberof/OtTvejsdKGc0HuXqzqHKSCXNgju2").once("value").then(function (snapshot) {
            snapshot.forEach((userSnap) => {
                db.ref("users/OtTvejsdKGc0HuXqzqHKSCXNgju2/members").child(userSnap.key).update({
                    lastupdate: Date.now()
                });
            });
            resolve();
        });
    }).then(function () {
        response.send("");
    });
    /*let db = admin.database();
    let lat2="";
    let lon2="";
    
    return new Promise((resolve,reject)=>{
        db.ref("users/0VuGZSMEJGUDW13nmkucYeNQkVo2").once("value").then(function(snapshot) {
               resolve(snapshot.val().latitude);
        });
    }).then(function(snapshot){
        response.send(snapshot);
    });*/
});
//# sourceMappingURL=index.js.map