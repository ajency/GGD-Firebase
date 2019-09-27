import { Application } from "express";
import Cart from "./controllers/CartController";
import Address from "./controllers/AddressController";

export function routesConfig(app: Application) {
	app.post('/add-to-cart',
		Cart.checkAvailability
	);

	app.post('/add-address',
		Address.addAddress
	);

	app.get('/get-addresses',
		Address.getAddresses
	);
}