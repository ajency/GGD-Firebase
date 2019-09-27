import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as express from 'express';
import * as cors from 'cors';
import * as bodyParser from 'body-parser';
import { routesConfig } from './routes-config';

let serviceAccount = require('../project-ggb-dev-service-account.json');

if (process.env.X_GOOGLE_FUNCTION_IDENTITY) {
	admin.initializeApp(functions.config().firebase);
}
else {
	admin.initializeApp({
		credential: admin.credential.cert(serviceAccount),
		databaseURL: "https://project-ggb-dev.firebaseio.com"
	});
}

const app = express();
app.use(bodyParser.json());
app.use(cors({ origin: true }));

routesConfig(app)

export const api = functions.https.onRequest(app);
