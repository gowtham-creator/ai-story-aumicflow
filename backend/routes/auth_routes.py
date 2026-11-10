from flask import Blueprint, request, jsonify, current_app, redirect
from utils.jwt_utils import create_jwt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
import bcrypt
import requests  # keep this separate from google_requests
import os
from bson import ObjectId

auth_bp = Blueprint("auth", __name__)

# REDIRECT_URI = "http://localhost:5000/api/google/callback"
# FRONTEND_URL = "http://localhost:5173"

# ✅ Register user
@auth_bp.route("/register", methods=["POST"])
def register():
    mongo = current_app.mongo.db
    data = request.get_json()
    name = data.get("name")
    email = data.get("email")
    password = data.get("password")

    if not all([name, email, password]):
        return jsonify({"error": "Missing fields"}), 400

    if mongo.users.find_one({"email": email}):
        return jsonify({"error": "Email already registered"}), 400

    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    new_user = {"name": name, "email": email, "password_hash": hashed, "picture": None}
    mongo.users.insert_one(new_user)

    return jsonify({"message": "Registered successfully"}), 201


# ✅ Login user
@auth_bp.route("/login", methods=["POST"])
def login():
    mongo = current_app.mongo.db
    data = request.get_json()
    email = data.get("email")
    password = data.get("password")

    user = mongo.users.find_one({"email": email})
    if not user or not bcrypt.checkpw(password.encode("utf-8"), user["password_hash"].encode("utf-8")):
        return jsonify({"error": "Invalid credentials"}), 401

    token = create_jwt(str(user["_id"]), user["email"])
    return jsonify({
        "jwt": token,
        "user": {"id": str(user["_id"]), "email": user["email"], "name": user["name"]}
    })


# ✅ Google Sign-In
@auth_bp.route("/google", methods=["POST"])
def google_login():
    mongo = current_app.mongo.db
    data = request.get_json()
    token = data.get("token")

    print("🔍 GOOGLE_CLIENT_ID (backend) =", current_app.config.get("GOOGLE_CLIENT_ID"))
    print("🔍 Token Received (first 20 chars) =", token[:20])


    if not token:
        return jsonify({"error": "Missing token"}), 400

    try:
        idinfo = id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            current_app.config.get("GOOGLE_CLIENT_ID")
        )

        email = idinfo.get("email")
        name = idinfo.get("name")
        picture = idinfo.get("picture")

        user = mongo.users.find_one({"email": email})
        if not user:
            new_user = {"email": email, "name": name, "picture": picture, "password_hash": None}
            mongo.users.insert_one(new_user)
            user = new_user

        db_user = mongo.users.find_one({"email": email})
        jwt_token = create_jwt(str(db_user["_id"]), db_user["email"])

        return jsonify({
            "jwt": jwt_token,
            "user": {
                "id": str(db_user["_id"]),
                "email": db_user["email"],
                "name": db_user["name"],
                "picture": db_user.get("picture"),
            }
        })

    except ValueError as e:
        print("Google token verify error:", e)
        return jsonify({"error": "Invalid Google token"}), 400