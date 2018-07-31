import * as functions from 'firebase-functions';
const admin = require('firebase-admin');
const cors = require("cors")
const express = require('express');
var NodeGeocoder = require('node-geocoder');

admin.initializeApp(functions.config().firebase);

const router = express.Router();
const db = admin.database();
const app = express()

const rad=(x)=> {
    return x * Math.PI / 180;
};
const getDistance=(lat1,long1,lat2,long2) => {
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

  const getGeoLocation=async (latitude,longtitude) => {
    let address="";
    let options = {
        provider: 'google',
        httpAdapter: 'https', 
        apiKey: 'AIzaSyCHZ-obEHL8TTP4_8vPfQKAyzvRrrlmi5Q', 
        formatter: null
      };
      let geocoder = NodeGeocoder(options);
      await geocoder.reverse({lat:latitude, lon:longtitude})
        .then(function(response) {
            let add=JSON.parse(response);
            address = response[0].formattedAddress;
        })
        .catch(function(err) {
            address="";
        });

        return address;
  };
  const processPlaceAlert=async (lat1,lon1,address,userid,firstname)=>{
    let placeArriveNotify:any=[];
    let placeLeftNotify:any=[];
    let fcmtoken="";
    
    let count=0;
    let cnt=0;
    return new Promise((resolve) => {
        db.ref("placealert/"+userid).once("value").then(async function(snapshot) {
        
            if(snapshot.numChildren()<=0){
                resolve()
            }else{
                
                count=snapshot.numChildren();
                snapshot.forEach((childSnapshot) =>{
                    let childPromise= new Promise((childResolve) => {
                        
                        db.ref('users/'+childSnapshot.val().placeowner).once("value", async function(fcmtokenSnapshot) {
                         if(fcmtokenSnapshot.val()!==null){
                                fcmtoken = fcmtokenSnapshot.val().fcmtoken;
                                if(childSnapshot.val().arrives===true){

                                    let distance= getDistance(Number(lat1),Number(lon1),Number(childSnapshot.val().latitude),Number(childSnapshot.val().longitude));
                                    if(Number(distance)<=200){
                                        
                                            placeArriveNotify.push({
                                                placeowner : childSnapshot.val().placeowner,
                                                fcmtoken : fcmtoken,
                                                placeid : childSnapshot.val().placeid,
                                                latitude : childSnapshot.val().latitude,
                                                longitude : childSnapshot.val().longitude,
                                                userid : userid
                                            })
                                        
                                    }
                                }
                                if(childSnapshot.val().leaves===true){
                                    placeLeftNotify.push({
                                        fcmtoken : fcmtoken,
                                        placeowner : childSnapshot.val().placeowner,
                                        placeid : childSnapshot.val().placeid,
                                        latitude : childSnapshot.val().latitude,
                                        longitude : childSnapshot.val().longitude,
                                        userid : userid
                                    })
                                }
                            }
                            childResolve()
                            
                        });
                    
                    }).then(function() {
                        cnt++;
                        if(cnt>=count){
                            resolve()
                        }
                    });

                    
                
                });
            }
        });
    }).then(async function() {
    
            
            await placeLeftNotify.forEach(async place => {
                await db.ref('placeshistory/'+place.placeowner+'/'+place.userid+'/'+place.placeid).once("value", async function(leavedataSnapshot) {
                    if(leavedataSnapshot.val()!==null){
                        let distance= getDistance(Number(lat1),Number(lon1),Number(leavedataSnapshot.val().latitude),Number(leavedataSnapshot.val().longitude));
                        if(Number(distance)>11){
                            await db.ref('places/'+place.placeowner+'/'+place.placeid).once("value", async function(placeSnapshot) {

                                let alert=firstname+" leaves "+placeSnapshot.val().placename;
                                
                                await db.ref('placeshistory/'+place.placeowner+'/'+place.userid+'/'+place.placeid).remove();

                                let message = {
                                    notification: {
                                    body: alert
                                    }
                                };
                                
                                let options = {
                                        priority: "high",
                                        sound: "default",
                                        timeToLive: 60 * 60 *24
                                };
                                
                                admin.messaging().sendToDevice(place.fcmtoken, message, options)
                                .then(function(response) {
                                    console.log("")
                                })
                                .catch(function(error) {
                                    console.log("")
                                });
                            });
                        }
                    }
                });
            });

            await setTimeout(async () => {
                await placeArriveNotify.forEach(async place => {
                    await db.ref('placeshistory/'+place.placeowner+'/'+place.userid+'/'+place.placeid).once("value", async function(arrivedataSnapshot) {
                        if(arrivedataSnapshot.val()===null){
                            await db.ref('placeshistory/'+place.placeowner+'/'+place.userid+'/'+place.placeid).set({ 
                                address : address,
                                latitude : place.latitude,
                                longitude : place.longitude,
                                arrives : true,
                                leaves : false,
                                datearrived :  Date.now()});
    
                                await db.ref('places/'+place.placeowner+'/'+place.placeid).once("value", async function(placeSnapshot) {
                                    let alert=firstname+" arrives "+placeSnapshot.val().placename;
                                        let message = {
                                            notification: {
                                            body: alert
                                            }
                                        };
                                        
                                        let options = {
                                                priority: "high",
                                                sound: "default",
                                                timeToLive: 60 * 60 *24
                                        };
                                        
                                        admin.messaging().sendToDevice(place.fcmtoken, message, options)
                                        .then(function(response) {
                                            console.log("")
                                        })
                                        .catch(function(error) {
                                            console.log("")
                                        });
                                });
                       
                        }
                    
                    });
                })
            }, 3000);
    })
}

const saveLocation=async (lat1,lon1,address,userid,dateadded)=>{
    let lat2="";
    let lon2="";

   
    await db.ref("users/"+userid).once("value").then(function(snapshot) {
            if(snapshot.val()!==null && snapshot.val().latitude!==undefined && snapshot.val().longitude!==undefined){
                lat2=snapshot.val().latitude;
                lon2=snapshot.val().longitude;
            }
            
        });
    
    if (lat2 == "" || lon2 == "" || lat2 == undefined || lon2 == undefined) {
        await db.ref('locations/' + userid).push({
            lat: lat1,
            lon: lon1,
            address: address,
            dateadded: dateadded
        });

        await db.ref("users").child(userid).update({
            address: address,
            latitude: lat1,
            longitude: lon1,
            lastmovement: dateadded
        })

        await db.ref("memberof/" + userid).once("value").then(function (snapshot) {
            snapshot.forEach((userSnap) => {
                if (userSnap.val().userid !== userid) {
                    db.ref("users/" + userSnap.val().userid + "/members/" + userid).set({
                        lastmovement: Date.now(),
                        userid: userid
                    })
                }
            });


        });

    }else{
                let distance = await getDistance(Number(lat1),Number(lon1),Number(lat2),Number(lon2));
                
                if(Number(distance)>=300){
                    
                    await db.ref('locations/'+userid).push({ 
                        lat : lat1,
                        lon : lon1,
                        address : address,
                        dateadded : dateadded});
                    
                    await db.ref("users").child(userid).update({
                            address:address,
                            latitude:lat1,
                            longitude:lon1,
                            lastmovement : dateadded
                        })
                        await db.ref("memberof/"+userid).once("value").then(function(snapshot) {
                            snapshot.forEach((userSnap) => {
                                if (userSnap.val().userid !== userid) {
                                    db.ref("users/" + userSnap.val().userid + "/members/" + userid).set({
                                        lastmovement: Date.now(),
                                        userid: userid
                                    })
                                }
                            });
                        })
                }
        }
}
app.get('/appendLocation', async function (req, res) {
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
    await geocoder.reverse({ lat: lat1, lon: lon1 })
        .then(async function (response) {
            address = response[0].formattedAddress;
            await processPlaceAlert(lat1, lon1, address, userid, firstname);
            await saveLocation(lat1, lon1, address, userid, dateadded);
        })
        .catch(function (err) {
            address = "";
        });

    res.send("updated");


})







app.get('/sendNotification', async function (req, res) {
    let token=req.query.token;

    let message = {
        notification: {
          title: "Places Movement",
          body: "This is the body of the notification message."
        }
      };
      
       let options = {
            priority: "high",
            sound: "default",
            timeToLive: 60 * 60 *24
      };
      
      //admin.messaging().send(message)
      admin.messaging().sendToDevice(token, message, options)
      .then(function(response) {
        console.log("Successfully sent message:", response);
      })
      .catch(function(error) {
        console.log("Error sending message:", error);
      });
     
        res.send("Location saved");
});


app.get('/getLastLocation', async function (req, res) {
    var options = {
        provider: 'google',

        // Optional depending on the providers
        httpAdapter: 'https', // Default
        apiKey: 'AIzaSyCHZ-obEHL8TTP4_8vPfQKAyzvRrrlmi5Q', // for Mapquest, OpenCage, Google Premier
        formatter: null         // 'gpx', 'string', ...
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



 

const api = functions.https.onRequest(app)

module.exports = {
    api
}