import * as admin from 'firebase-admin';
import { Request, Response } from "express";

let User = {
	
	userExists:  async (req: Request, res: Response) => {

		let phone_number = req.query.phone_number;

		if (!phone_number ) {
			return res.status(400).send({ message: 'Missing fields' });
		}

		let user_exist = await User.getUser("+91" + phone_number);
		if(user_exist){
			return res.status(200).send({ success: true, message: 'User exists'});
		}
		else{
			const  user_present_in_db =  await User.checkInDb(phone_number)
			if(user_present_in_db) {
				return res.status(200).send({ success: true, message: 'User exists'});
			} else {
				return res.status(200).send({ success: false, message: 'User does not exist'});
			}
		}
	},


	getUser: async (number: string) : Promise<any> => {
		console.log("number ==>", number);

		let result = await admin.auth().getUserByPhoneNumber(number)
		  .then(function(userRecord) {
		    console.log('Successfully fetched user data:', userRecord.toJSON());
		    return true;
		  })
		  .catch(function(error) {
		    console.log('Error fetching user data:', error);
		    return false;
		  });

		return result;
	},

	checkInDb: async (number:string): Promise<any> => {
		const firestore = admin.firestore(); 
		const data = await firestore.collection('user-details').where('phone', "==", number).get();
		console.log(data.size,"checkInDb===>");
		
		const size = await data.size
		if(size) {
			return true
		} else {
			return false
		}
	},


	updateUserDetails : async (req : Request, res: Response) => {
		try {
			let { phone, name, email, uid, is_verified } = req.body;
			console.log("check user details ==>", phone, name, email, uid, is_verified);

			let firestore = admin.firestore();
			let user = await firestore.collection('user-details').doc(uid).get();
			let data;
			if (user.exists){
				let user_data = user.data();
				data = {
					phone : phone ? phone : user_data.phone, 
				  	name: name ? name : user_data.name,
				  	email : email ? email : user_data.email,
				  	verified : is_verified
				};
			}
			else{
				data = {
					phone : phone ? phone : '', 
				  	name: name ? name : '',
				  	email : email ? email : '',
				  	verified : is_verified
				};
			}
			console.log("set user data =>", data)
			await firestore.collection('user-details').doc(uid).set(data);
			return res.status(200).send({ success: true, message: 'User details updated successfully'});

		}
		catch (err) {
			return User.handleError(res, err)
		}
	},

	mapOrdersAddresses : async (req : Request, res : Response) => {
		try {
			let { phone_from_admin, uid, is_verified } = req.body;

			let firestore = admin.firestore();
			let orders_ref1 = await firestore.collection('orders')
					.where("user_id", ">", uid)
					.where("mobile_number", "==", phone_from_admin)
					.get();

			let orders_ref2 = await firestore.collection('orders')
					.where("user_id", ">", uid)
					.where("mobile_number", "==", phone_from_admin)
					.get();

			let orders = [];
			orders_ref1.forEach(doc => {
				let obj = doc.data();
				obj.id = doc.id;
				orders.push(obj);
			})

			orders_ref2.forEach(doc => {
				let obj = doc.data();
				obj.id = doc.id;
				orders.push(obj);
			})


			let addresses_ref1 = await firestore.collection('addresses')
					.where("user_id", ">", uid)
					.where("mobile_number", "==", phone_from_admin)
					.get();

			let addresses_ref2 = await firestore.collection('addresses')
					.where("user_id", ">", uid)
					.where("mobile_number", "==", phone_from_admin)
					.get();

			let addresses = [];
			addresses_ref1.forEach(doc => {
				let obj = doc.data();
				obj.id = doc.id;
				addresses.push(obj);
			})
			
			addresses_ref2.forEach(doc => {
				let obj = doc.data();
				obj.id = doc.id;
				addresses.push(obj);
			})

			for (const order of orders) {
				await firestore.collection('orders').doc(order.id)
					.update({ user_id : uid })
			}

			for (const address of addresses) {
				await firestore.collection('orders').doc(address.id)
					.update({ user_id : uid })
			}
			
			return res.status(200).send({ success: true, message: 'Successfully mapped orders and addresses'});

		}
		catch (err) {
			return User.handleError(res, err)
		}
	},

	handleError : (res: Response, err: any) => {
		return res.status(500).send({ message: `${err.code} - ${err.message}` });
	},
	
}

export default User;