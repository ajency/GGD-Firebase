import { Request, Response } from "express";
import * as admin from 'firebase-admin';

let Address = {

	addAddress: async (req: Request, res: Response) => {
		 try {
		 		let firestore = admin.firestore();
				const { name, phone, pincode, address, city, state, set_default, lat_long, landmark} = req.body;

				 //if params are missing
				if (!name || !phone || !pincode || !address || !city || !state || !set_default || !lat_long) {
					return res.status(400).send({ message: 'Missing fields' })
				}

				if(phone && phone.length != 10)
					return res.status(400).send({ message: 'Invalid phone number' });

				//TODO : get UID from id token

				let address_obj = {
					user_id : "edfdferererer",
					address : {}
				}
				let user_address = {
					name		: name,
					phone		: phone,
					address 	: address,
					landmark 	: landmark,
					city 		: city,
					state 		: state,
					pincode 	: pincode,
					default 	: set_default,
					lat_long	: lat_long,
					id			: ''
				}
				address_obj.address = user_address;
				let address_ref = firestore.collection('addresses').doc();
				await address_ref.set(address_obj);
				user_address.id = address_ref.id;
				return res.status(200).send({ success: true, message: 'Address added successfully', address : user_address});

		} catch (err) {
				return Address.handleError(res, err)
		}
	},

	getAddresses:  async (req: Request, res: Response) => {
		 try {
		 		let firestore = admin.firestore();
				
				// TODO : get UID from id token
				let addresses_ref = await firestore.collection('addresses')
					.where("user_id", "==", "edfdferererer")
					.get();

					let addresses = addresses_ref.docs.map(doc => {
						let obj = doc.data();
						obj.id = doc.id
						return obj;
					})

					return res.status(200).send({ success: true, addresses : addresses });

		} catch (err) {
				return Address.handleError(res, err)
		}
	},

	 handleError : (res: Response, err: any) => {
		return res.status(500).send({ message: `${err.code} - ${err.message}` });
	},
}

export default Address;