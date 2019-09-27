import * as admin from 'firebase-admin';


let Locations = {

	getLocations: async (id: string, quantity : number) => {
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
	}
}

export default Locations;