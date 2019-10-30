import { Request, Response } from "express";
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
			let url = "https://maps.googleapis.com/maps/api/place/details/json?place_id="+ req.query.place_id +"&fields=address_component,formatted_address,geometry,types&key=" + credentials.maps_api_key;
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
			let url = "https://maps.googleapis.com/maps/api/geocode/json?latlng=" + req.query.latlng +"&key=" + credentials.maps_api_key;;
			axios.get(url)
			  .then(function (response) {
			    	return res.status(200).send(response.data);
			  })
			  .catch(function (error) {
			    	console.log("error from swiggy api ==>",error);
			    	return res.status(500).send(error);
			  })
		}
	}
}

export default misc;