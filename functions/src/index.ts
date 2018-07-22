import * as functions from 'firebase-functions';
const admin = require('firebase-admin');
const cors = require("cors")
const express = require('express');
//const maps = require('@google/maps')
/*
var googleMapsClient = require('@google/maps').createClient({
    key: 'xxx',
    Promise: Promise
  });

  console.log(snapadd + " snap user address (((((((())))))))");
  if(snapadd != null || typeof snapadd != undefined) {
          googleMapsClient.geocode({
            address: snapadd
          }).asPromise()
              .then(response =>  console.log(response.json.results));
              .catch(err => console.log(err))
  }   
//}))
//console.log(typeof user + 'type of');
*/

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
  const processPlaceAlert=async (lat1,lon1,address,userid,firstname)=>{
    let placeArriveNotify:any=[];
    let placeLeftNotify:any=[];
    await db.ref("placealert/"+userid).once("value").then(async function(snapshot) {
        await snapshot.forEach((childSnapshot) =>{
            if(childSnapshot.val().arrives===true){
                let distance= getDistance(Number(lat1),Number(lon1),Number(childSnapshot.val().latitude),Number(childSnapshot.val().longitude));
                if(Number(distance)<=10){
                    placeArriveNotify.push({
                        placeowner : childSnapshot.val().placeowner,
                        placeid : childSnapshot.val().placeid,
                        latitude : childSnapshot.val().latitude,
                        longitude : childSnapshot.val().longitude,
                        userid : userid
                    })
                   
                }
            }
            if(childSnapshot.val().leaves===true){
                placeLeftNotify.push({
                    placeowner : childSnapshot.val().placeowner,
                    placeid : childSnapshot.val().placeid,
                    latitude : childSnapshot.val().latitude,
                    longitude : childSnapshot.val().longitude,
                    userid : userid
                })
            }
        });
    });
        
        if(placeArriveNotify.length>0){
            await placeArriveNotify.forEach(async place => {
                await db.ref('placeshistory/'+place.placeowner+'/'+place.userid+'/'+place.placeid).once("value", async function(dataSnapshot) {
                    if(dataSnapshot.val()===null){
                        await db.ref('placeshistory/'+place.placeowner+'/'+place.userid+'/'+place.placeid).set({ 
                            address : address,
                            latitude : place.latitude,
                            longitude : place.longitude,
                            arrives : true,
                            leaves : false,
                            datearrived :  Date.now()});

                            await db.ref('places/'+place.placeowner+'/'+place.placeid).once("value", async function(placeSnapshot) {

                                let message=firstname+" arrives "+placeSnapshot.val().placename;

                                await db.ref('notification/placealert/'+place.placeowner).push({ 
                                    placename : placeSnapshot.val().placename,
                                    address : placeSnapshot.val().address,
                                    message : message,
                                    action : 'arrives',
                                    dateadded :  Date.now()
                                    });

                            });
                    
                        
                   
                    }
                
                });
            })
         }
        if(placeLeftNotify.length>0){
            await placeLeftNotify.forEach(async place => {
                await db.ref('placeshistory/'+place.placeowner+'/'+place.userid+'/'+place.placeid).once("value", async function(dataSnapshot) {
                    if(dataSnapshot.val()!==null){
                        let distance= getDistance(Number(lat1),Number(lon1),Number(dataSnapshot.val().latitude),Number(dataSnapshot.val().longitude));
                        if(Number(distance)>11){
                            await db.ref('places/'+place.placeowner+'/'+place.placeid).once("value", async function(placeSnapshot) {

                                let message=firstname+" leaves "+placeSnapshot.val().placename;

                                await db.ref('notification/placealert/'+place.placeowner).push({ 
                                    placename : placeSnapshot.val().placename,
                                    address : placeSnapshot.val().address,
                                    message : message,
                                    action : 'leaves',
                                    dateadded :  Date.now()
                                    });
                                
                                await db.ref('placeshistory/'+place.placeowner+'/'+place.userid+'/'+place.placeid).remove();
                            });
                        }
                    }
                });
            });
        }
}

const saveLocation=async (lat1,lon1,address,userid,dateadded)=>{
    let lat2="";
    let lon2="";

   
    
    await db.ref("users/"+userid).once("value").then(function(snapshot) {
            if(snapshot.val()!==null && snapshot.val().latitude!=undefined && snapshot.val().longitude!=undefined){
                lat2=snapshot.val().latitude;
                lon2=snapshot.val().longitude;
            }
            
        });
    
        if(lat2=="" || lon2=="" || lat2===undefined || lon2==undefined){
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

        }else{
                let distance = await getDistance(Number(lat1),Number(lon1),Number(lat2),Number(lon2));
                
                if(Number(distance)>=10){
                    
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
                }
        }
}
app.get('/appendLocation', async function (req, res) {
    let lat1=req.query.lat;
    let lon1=req.query.lon;
    let address = req.query.address;
    let userid=req.query.userid;
    let dateadded=req.query.dateadded;
    let firstname=req.query.firstname;
    
    await processPlaceAlert(lat1,lon1,address,userid,firstname);
    await saveLocation(lat1,lon1,address,userid,dateadded);
   // let geocoder = new maps.Geocoder;
    let latlng = {lat:  parseFloat(lat1), lng: parseFloat(lon1)};

    /*geocoder.geocode({'location': latlng}, function(results, status) {
        res.send(results);
      });*/
        res.send("updated");

    
 })





const api = functions.https.onRequest(app)

module.exports = {
  api
}


/*
const rad=(x)=> {
    return x * Math.PI / 180;
};
const getDistance=(lat1,long1,lat2,long2) =>{
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

  */

  /*
  export const saveLocation1 = functions.https.onRequest((request, response) => {

  })
export const saveLocation = functions.https.onRequest((request, response) => {

    let lat2="";
    let lon2="";

    let lat1=request.query.lat;
    let lon1=request.query.lon;
    let address = request.query.address;
    let userid=request.query.userid;
    let dateadded=request.query.dateadded;
   


    
    let parentPromise=new Promise((resolve,reject)=>{
        db.ref("users/"+userid).once("value").then(function(snapshot) {
            if(snapshot.val()!==null && snapshot.val().latitude!=undefined && snapshot.val().longitude!=undefined){
                lat2=snapshot.val().latitude;
                lon2=snapshot.val().longitude;
                resolve();
            }else{
                resolve();
            }
            
        });
    }).then(()=>{
        if(lat2=="" || lon2=="" || lat2===undefined || lon2==undefined){
            db.ref('locations/'+userid).push({ 
                lat : lat1,
                lon : lon1,
                address : address,
                dateadded : dateadded});
            
            db.ref("users").child(userid).update({
                    address:address,
                    latitude:lat1,
                    longitude:lon1,
                    lastmovement : dateadded
                })

        }else{
            let childPromise = new Promise((resolve,reject)=>{
                let movement=getDistance(Number(lat1),Number(lon1),Number(lat2),Number(lon2));
                
                resolve(movement);
            }).then(function(movement){
                if(Number(movement)>=10){
                    
                    db.ref('locations/'+userid).push({ 
                        lat : lat1,
                        lon : lon1,
                        address : address,
                        dateadded : dateadded});
                    
                    db.ref("users").child(userid).update({
                            address:address,
                            latitude:lat1,
                            longitude:lon1,
                            lastmovement : dateadded
                        })
                }
            })
        }
        response.send("Location saved");
        
    });
    
    
});
*/
app.get('/getLastLocation', async function (req, res) {
    var registrationToken="dEIg-95Y_xY:APA91bEhFFNwhQWmfPpX0yOj2HG8UuvErxvrJpxlbXqmf-hGm_2b7oMHDMYrRUyKQo46_inBv-C1-z7RB63WADwD2m54Z-wgeBf9ay53GOyGwfb2n7u_ycecV6BEXqSkvxe_Q5gPuHdURd_2e_YqF31gs01X1vIDBA";

    var payload = {
        notification: {
          title: "Places Movement",
          body: "This is the body of the notification message."
        }
      };
      
       var options = {
        priority: "high",
        sound: "default",
        timeToLive: 60 * 60 *24
      };
      
      admin.messaging().sendToDevice(registrationToken, payload, options)
      .then(function(response) {
        console.log("Successfully sent message:", response);
      })
      .catch(function(error) {
        console.log("Error sending message:", error);
      });
     
        res.send("Location saved");
});
