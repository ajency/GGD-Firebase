import * as admin from 'firebase-admin';
import { Request, Response } from "express";
import  {users} from '../data/usersData'
let User = {
	
	userExists:  async (req: Request, res: Response) => {

		let phone_number = req.query.phone_number;

		if (!phone_number ) {
			return res.status(400).send({ message: 'Missing fields' });
		}

		// let user_exist = await User.getUser("+91" + phone_number);
		// if(user_exist){
		// 	return res.status(200).send({ success: true, message: 'User exists'});
		// }
		// else{
			const  user_present_in_db =  await User.checkInDb(phone_number)
			if(user_present_in_db) {

				return res.status(200).send({ success: true, message: 'User exists'});
			} else {
				return res.status(200).send({ success: false, message: 'User does not exist'});
			}
		// }
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
			let oldUser = false
			for(let i =0; i<size; i++) {
				console.log(i)
				let address = await data.docs[i].ref.collection('address').get();
				let orders = await data.docs[i].ref.collection('orders').get();
				if(!address.empty || !orders.empty) {
					oldUser = true
					break;
				}
			}
			
			return oldUser
		} else {
			return false
		}
	},


	updateUserDetails : async (req : Request, res: Response) => {
		try {
			let { phone, name, email, uid, is_verified, default_address_id } = req.body;
			console.log("user details ==>", phone, name, email, uid, is_verified);

			let firestore = admin.firestore();
			let user = await firestore.collection('user-details').doc(uid).get();
			let data;
			if (user.exists){
				
				let user_data = user.data();
				data = {
					phone : phone ? phone : user_data.phone, 
				  	name: name ? name : user_data.name,
					email : email ? email : user_data.email,
					default_address_id: user_data.default_address_id? user_data.default_address_id:'',
				  	verified : is_verified
				};
				console.info('updating- user ==> ', data)
			}
			else {
				data = {
					phone : phone ? phone : '', 
				  	name: name ? name : '',
					email : email ? email : '',
					default_address_id:  default_address_id? default_address_id:'',
				  	verified : is_verified
				};
				console.info('updating-ffff new ==> ', data)
				//get 1 collection not imported
				if(is_verified){

					const readyTOMigrate = await firestore.collection('user-details').where('phone', "==", phone).where("imported", "==", "false").limit(1).get()
					if(!readyTOMigrate.empty) {
						console.info("readyTOMigrate");
						const rawData = readyTOMigrate.docs[0]
						// readyTOMigrate.forEach( async rawData => {
							
							try {
								const userDetails = rawData.data()
								console.log(userDetails,"userDetails=>");
								delete userDetails.imported
								data = {...data, ...userDetails, verified : is_verified}
								console.log(data,"data new =>");
								await firestore.collection('user-details').doc(uid).set(data);
								const addresses = await rawData.ref.collection('addresses').limit(1).get()
								const address = addresses.docs[0]
								// addresses.forEach( async address => {
									if(address.exists) {
										const addressData = address.data()
										await firestore.collection('user-details').doc(uid).collection('addresses').doc(address.id).set({...addressData})
									}
								// })
								await firestore.collection('user-details').doc(rawData.id).update({"imported":"true"})
							} catch (error) {
								console.log("data migration isssue =>")
							}
						// })
					}
				}

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

	migrateUser :async (req : Request, res : Response) => {
		let db = admin.firestore();
		users.map(async (user) => {
			try {
			   const docid = await db.collection('user-details').add({
					name: user.name,
					email:user.email,
					phone:user.phone.toString(),
					imported:"false"
				})
				let address = {
					...user,
					phone:user.phone.toString(),
					verified:true,
					pincode: user.pincode.toString(),
					lat_long: [user.lat.toString(), user.long.toString()],
					default:false
				}
				delete address.lat
				delete address.long
				const addr_ref= await db.collection('user-details').doc(docid.id).collection('addresses').add(address)
				await db.collection('user-details').doc(docid.id).update({default_address_id:addr_ref.id})
			} catch (error) {
				console.log(error);
				// return res.status(200).send({ success: true, message: 'done'});
			}
		})
		// return res.status(200).send({ success: true, message: 'done'});
	}
	
}

export default User;