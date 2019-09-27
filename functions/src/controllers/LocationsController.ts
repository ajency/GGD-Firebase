import * as admin from 'firebase-admin';


let Locations = {

    getLocations: async (id: string, quantity : number) => {
        let firestore = admin.firestore();
        let locations = await firestore.collection('stocks')
                .where("variant_id", "==", id)
                .where("quantity", ">=", quantity)
                .get();

        let result = locations.docs.map(doc => {
            return doc.data()
        })
        return result;
    }
}

export default Locations;