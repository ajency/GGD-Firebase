import { Application } from "express";
import Cart from "./controllers/CartController";

export function routesConfig(app: Application) {
	app.post('/add-to-cart',
		Cart.checkAvailability
	);
}