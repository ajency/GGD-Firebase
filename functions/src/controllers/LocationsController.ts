import * as admin from 'firebase-admin';


let Locations = {

	getLocationWithStock: async (id: string, quantity : number) => {
		let firestore = admin.firestore();
		// get the locations ids from the stocks collection where the quantity is available
		let stocksRef = await firestore.collection('stocks')
				.where("variant_id", "==", id)
				.where("quantity", ">=", quantity)
				.get();

		let stocks = stocksRef.docs.map(doc => {
			return doc.data()
		})

		// if stock is available in atleast one location
		if(stocks.length){
			//get locations
			let locationsRef = await firestore.collection('locations').get();
			let allLocations = 	locationsRef.docs.map(doc => {
	  			let obj = doc.data();
	  			obj.id = doc.id;
	  			return obj;
			});

			//get availble locations
		  	let availableLoc : Array <any> = [];
			stocks.forEach((stock)=>{
				availableLoc.push(Locations.findLocation(allLocations,stock.loc_id))
			})
			return availableLoc;
		}
		else
			return [];
	},

	findLocation: (locations : Array<any>, id : string) => {
		let location =  locations.find((loc) => {
			return loc.id == id
		})
		return location;
	},

	getStock : async (loc_id : string, variant_id : string, quantity : number) =>{
		let firestore = admin.firestore();
		let stocks_ref = await firestore.collection('stocks')
			.where("loc_id", "==", loc_id)
			.where("variant_id", "==", variant_id)
			.where("quantity", ">=", quantity)
			.get();
		let stock = stocks_ref.docs.map(doc => {
			return doc.data()
		})
		return stock;
	},

	getLocation : async (loc_id : string) => {
		let firestore = admin.firestore();
		let location = await firestore.collection('locations').doc(loc_id).get();
		if(location.exists){
			return [location.data()];
		}
		return [];
	}
}

export default Locations;