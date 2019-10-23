import * as admin from 'firebase-admin';
import { Request, Response } from "express";

let User = {
	
	userExists:  async (req: Request, res: Response) => {

		let phone_number = req.query.phone_number;

		if (!phone_number ) {
			return res.status(400).send({ message: 'Missing fields' });
		}

		let user_exist = await User.getUser("+91" + phone_number);
		console.log("user exits ==>", user_exist);
		if(user_exist){
			return res.status(200).send({ success: true, message: 'User exists'});
		}
		else{
			return res.status(400).send({ success: false, message: 'User does not exist'});
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
				  	verfied : is_verified
				};
			}
			else{
				data = {
					phone : phone ? phone : '', 
				  	name: name ? name : '',
				  	email : email ? email : '',
				  	verfied : is_verified
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

	handleError : (res: Response, err: any) => {
		return res.status(500).send({ message: `${err.code} - ${err.message}` });
	},
	
}

export default User;