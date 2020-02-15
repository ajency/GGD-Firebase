import { Request, Response } from "express";
import * as admin from 'firebase-admin';
const axios = require('axios');
const credentials = require('../../credentials.json')
const config = require('../../config.json');

let misc = {
	placesAutoComplete : async (req : Request, res : Response) => {
		let url = "https://maps.googleapis.com/maps/api/place/autocomplete/json?input="+ req.query.input +"&types=establishment&components=country:in&location="+ config.location +"&radius="+ config.radius +"&strictbounds&&key=" + credentials.maps_api_key;
		axios.get(url)
		  .then(function (response) {
		    	return res.status(200).send(response.data);
		  })
		  .catch(function (error) {
		    	console.log(error);
		    	return res.status(500).send(error);
		  })
	},

	reverseGeoCode : async (req : Request, res : Response) => {
		if(req.query.place_id){
			let url = "https://maps.googleapis.com/maps/api/place/details/json?place_id="+ req.query.place_id +"&fields=name,address_component,formatted_address,geometry,types&key=" + credentials.maps_api_key;
			axios.get(url)
			  .then(function (response) {
			    	return res.status(200).send(response.data);
			  })
			  .catch(function (error) {
			    	console.log(error);
			    	return res.status(500).send(error);
			  })
		}
		else if(req.query.latlng){
			// let url = "https://www.swiggy.com/dapi/misc/reverse-geocode?latlng=" + req.query.latlng;
			let url = "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + req.query.latlng +"&key=" + credentials.maps_api_key;
			axios.get(url)
			  .then(function (response) {
			    	return res.status(200).send(response.data);
			  })
			  .catch(function (error) {
			    	console.log("error from swiggy api ==>",error);
			    	return res.status(500).send(error);
			  })
		}
	},

	storeFcmToken : async (req : Request, res : Response) => {
		let firestore = admin.firestore();
		let obj = {
			fcm_token : req.query.fcm_token,
			device : req.query.device
		}
		await firestore.collection('fcm_tokens').doc().set(obj);
		// console.log("check token =>", req.query.fcm_token)
		let url = 'https://iid.googleapis.com/iid/v1/'+ req.query.fcm_token +'/rel/topics/ggb';
		let headers = {
			'Content-Type': 'application/json', 
			'Authorization' : 'key='+credentials.fcm_api_key
		}
		axios.post(url, {}, {headers : headers})
	    .then(function (response) {
	        // console.log(response);
	        return res.status(200).send({success : true});
	    })
	    .catch(function (response) {
	    	// console.log(response);
	    	return res.status(500).send({success : false});
		});
	},
}

export default misc;