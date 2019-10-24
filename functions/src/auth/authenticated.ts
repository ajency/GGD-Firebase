import { Request, Response } from "express";
import * as admin from 'firebase-admin';

export async function isAuthenticated(req: Request, res: Response, next: Function) {
	const { authorization } = req.headers

	if (!authorization || !authorization.startsWith('Bearer'))
			return res.status(401).send({ message: 'Unauthenticated' });

	const split = authorization.split('Bearer ');
	const token = split[1]

	try {
			const decodedToken: admin.auth.DecodedIdToken = await admin.auth().verifyIdToken(token);
			console.log("decodedToken", JSON.stringify(decodedToken))
			if(req.method == 'POST'){
				req.body.uid = decodedToken.uid;
				req.body.is_verified = decodedToken.provider_id === 'anonymous' ? false : true;
				req.body.phone_from_admin = decodedToken.phone_number;
			}
			else{
				req.query.uid = decodedToken.uid;
				req.query.is_verified = decodedToken.provider_id === 'anonymous' ? false : true;
				req.query.phone_from_admin = decodedToken.phone_number;
			}
				 
			return next();
	}
	catch (err) {
			console.error(`${err.code} -  ${err.message}`)
			return res.status(401).send({ message: 'Unauthenticated' });
	}
}