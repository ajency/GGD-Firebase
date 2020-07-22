import * as admin from 'firebase-admin';
import { Request, Response } from "express";
const config = require('../../config.json');
const cred = require('../../credentials.json');


let Cart = {

	reCalculate: async (req:Request, res:Response) => {

		try {
			// let { uid, cartId, couponCode, operation } = req.body
			let responseData = {}
			
			// fetch user from request
			// console.log("request details ==>", uid, cartId, couponCode, operation)

			responseData = { success: true, message: 'Coupon Applied successfully', data : {}}
			
			return res.sendStatus(200).send(responseData)
		} catch (error) {
			console.log(error)
			return res.status(200).send({ success: false, message: 'Error in applying coupon', data : error})
		}

	}	
}

export default Cart;