// ==========================================
// FIREBASE CONFIGURATION
// ==========================================
//
// Replace these values with your Firebase
// project configuration.
// ==========================================

const firebaseConfig = {

    apiKey: "YOUR_API_KEY",

    authDomain: "YOUR_PROJECT.firebaseapp.com",

    databaseURL:
        "https://YOUR_PROJECT-default-rtdb.firebaseio.com",

    projectId: "YOUR_PROJECT",

    storageBucket:
        "YOUR_PROJECT.firebasestorage.app",

    messagingSenderId: "YOUR_SENDER_ID",

    appId: "YOUR_APP_ID"
};


// Initialize Firebase

firebase.initializeApp(firebaseConfig);

const database = firebase.database();


// ==========================================
// VARIABLES
// ==========================================

let myId = null;

let myName = "";

let roomCode = "";

let myLocation = null;

let targetLocation = null;

let targetUserId = null;

let currentHeading = 0;

let compassEnabled = false;


// ==========================================
// HTML ELEMENTS
// ==========================================

const joinScreen =
    document.getElementById("joinScreen");

const mainApp =
    document.getElementById("mainApp");

const nameInput =
    document.getElementById("nameInput");

const roomInput =
    document.getElementById("roomInput");

const joinButton =
    document.getElementById("joinButton");

const joinError =
    document.getElementById("joinError");

const userSelect =
    document.getElementById("userSelect");

const arrow =
    document.getElementById("arrow");

const targetName =
    document.getElementById("targetName");

const distanceElement =
    document.getElementById("distance");

const directionElement =
    document.getElementById("directionText");

const bearingElement =
    document.getElementById("bearing");

const headingElement =
    document.getElementById("heading");

const usersList =
    document.getElementById("usersList");

const roomDisplay =
    document.getElementById("roomDisplay");

const statusElement =
    document.getElementById("status");

const compassButton =
    document.getElementById("compassButton");

const leaveButton =
    document.getElementById("leaveButton");


// ==========================================
// JOIN ROOM
// ==========================================

joinButton.addEventListener("click", joinRoom);


function joinRoom() {

    myName = nameInput.value.trim();

    roomCode = roomInput.value.trim().toUpperCase();


    if (!myName) {

        joinError.textContent =
            "Please enter your name.";

        return;
    }


    if (!roomCode) {

        joinError.textContent =
            "Please enter a room code.";

        return;
    }


    // Generate unique user ID

    myId =
        database.ref().push().key;


    // Create user object

    const userData = {

        name: myName,

        latitude: null,

        longitude: null,

        timestamp:
            firebase.database.ServerValue.TIMESTAMP
    };


    // Save user

    database
        .ref(`rooms/${roomCode}/users/${myId}`)
        .set(userData);


    // Automatically remove user when
    // browser disconnects

    database
        .ref(`rooms/${roomCode}/users/${myId}`)
        .onDisconnect()
        .remove();


    // Show application

    joinScreen.classList.add("hidden");

    mainApp.classList.remove("hidden");

    roomDisplay.textContent = roomCode;

    statusElement.textContent =
        "Getting your location...";


    // Start GPS

    startLocationTracking();


    // Watch other users

    listenForUsers();

}


// ==========================================
// GPS
// ==========================================

function startLocationTracking() {

    if (!navigator.geolocation) {

        statusElement.textContent =
            "GPS is not supported by this browser.";

        return;
    }


    navigator.geolocation.watchPosition(

        position => {

            const latitude =
                position.coords.latitude;

            const longitude =
                position.coords.longitude;


            myLocation = {

                latitude,
                longitude
            };


            // Update Firebase

            database
                .ref(
                    `rooms/${roomCode}/users/${myId}`
                )
                .update({

                    latitude: latitude,

                    longitude: longitude,

                    timestamp:
                        firebase.database.ServerValue.TIMESTAMP
                });


            statusElement.textContent =
                "GPS location updated.";

            updateCompass();

        },

        error => {

            console.error(error);

            statusElement.textContent =
                "Unable to get GPS location. " +
                "Please allow location permission.";
        },

        {

            enableHighAccuracy: true,

            maximumAge: 2000,

            timeout: 10000
        }

    );

}


// ==========================================
// LISTEN FOR USERS
// ==========================================

function listenForUsers() {

    const usersRef =
        database.ref(`rooms/${roomCode}/users`);


    usersRef.on("value", snapshot => {

        const users =
            snapshot.val() || {};


        updateUserList(users);

    });

}


// ==========================================
// UPDATE USER LIST
// ==========================================

function updateUserList(users) {

    userSelect.innerHTML =
        `<option value="">Select a user</option>`;

    usersList.innerHTML = "";


    Object.entries(users).forEach(
        ([id, user]) => {

            // Don't show ourselves as target

            if (id !== myId) {

                const option =
                    document.createElement("option");

                option.value = id;

                option.textContent =
                    user.name;

                userSelect.appendChild(option);


                // User list

                const div =
                    document.createElement("div");

                div.className =
                    "user-item";


                const hasLocation =
                    user.latitude !== null &&
                    user.longitude !== null;


                div.innerHTML = `

                    <span>
                        ${escapeHTML(user.name)}
                    </span>

                    <span class="user-online">
                        ${hasLocation ? "● Online" : "Waiting..."}
                    </span>

                `;


                usersList.appendChild(div);
            }

        });


    // If selected target still exists,
    // update its location

    if (targetUserId && users[targetUserId]) {

        targetLocation = {

            latitude:
                users[targetUserId].latitude,

            longitude:
                users[targetUserId].longitude
        };


        targetName.textContent =
            users[targetUserId].name;


        updateCompass();

    }

}


// ==========================================
// USER SELECTION
// ==========================================

userSelect.addEventListener(
    "change",
    () => {

        targetUserId =
            userSelect.value;


        if (!targetUserId) {

            targetLocation = null;

            targetName.textContent =
                "No target selected";

            distanceElement.textContent =
                "--";

            directionElement.textContent =
                "--";

            bearingElement.textContent =
                "--";

            return;
        }


        database
            .ref(
                `rooms/${roomCode}/users/${targetUserId}`
            )
            .once("value")
            .then(snapshot => {

                const user =
                    snapshot.val();


                if (!user) return;


                targetLocation = {

                    latitude:
                        user.latitude,

                    longitude:
                        user.longitude
                };


                targetName.textContent =
                    user.name;


                updateCompass();

            });

    }
);


// ==========================================
// COMPASS PERMISSION
// ==========================================

compassButton.addEventListener(
    "click",
    enableCompass
);


async function enableCompass() {

    try {

        // iPhone/iPad require permission

        if (
            typeof DeviceOrientationEvent !==
            "undefined" &&

            typeof DeviceOrientationEvent
                .requestPermission ===
                "function"
        ) {

            const permission =
                await DeviceOrientationEvent
                    .requestPermission();


            if (permission !== "granted") {

                statusElement.textContent =
                    "Compass permission denied.";

                return;
            }
        }


        window.addEventListener(
            "deviceorientationabsolute",
            handleOrientation,
            true
        );


        window.addEventListener(
            "deviceorientation",
            handleOrientation,
            true
        );


        compassEnabled = true;


        compassButton.textContent =
            "Compass Enabled";


        statusElement.textContent =
            "Compass is active.";


    } catch (error) {

        console.error(error);

        statusElement.textContent =
            "Could not enable compass.";
    }

}


// ==========================================
// PHONE ORIENTATION
// ==========================================

function handleOrientation(event) {

    let heading = null;


    // iPhone

    if (
        typeof event.webkitCompassHeading ===
        "number"
    ) {

        heading =
            event.webkitCompassHeading;

    }

    // Android / standard

    else if (
        typeof event.alpha ===
        "number"
    ) {

        heading =
            360 - event.alpha;
    }


    if (heading === null) return;


    currentHeading =
        normalizeAngle(heading);


    headingElement.textContent =
        `${Math.round(currentHeading)}°`;


    updateCompass();

}


// ==========================================
// UPDATE COMPASS
// ==========================================

function updateCompass() {

    if (
        !myLocation ||
        !targetLocation ||
        targetLocation.latitude === null ||
        targetLocation.longitude === null
    ) {

        return;
    }


    // Calculate bearing

    const targetBearing =
        calculateBearing(

            myLocation.latitude,

            myLocation.longitude,

            targetLocation.latitude,

            targetLocation.longitude

        );


    // Calculate distance

    const distance =
        calculateDistance(

            myLocation.latitude,

            myLocation.longitude,

            targetLocation.latitude,

            targetLocation.longitude

        );


    // Difference between target direction
    // and direction phone is facing

    const arrowRotation =
        normalizeAngle(
            targetBearing -
            currentHeading
        );


    // Rotate arrow

    arrow.style.transform =

        `translate(-50%, -50%)
         rotate(${arrowRotation}deg)`;


    // Display data

    bearingElement.textContent =
        `${Math.round(targetBearing)}°`;


    distanceElement.textContent =
        formatDistance(distance);


    directionElement.textContent =
        getDirectionName(targetBearing);

}


// ==========================================
// BEARING CALCULATION
// ==========================================

function calculateBearing(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const φ1 =
        lat1 * Math.PI / 180;

    const φ2 =
        lat2 * Math.PI / 180;


    const Δλ =
        (lon2 - lon1) *
        Math.PI / 180;


    const y =
        Math.sin(Δλ) *
        Math.cos(φ2);


    const x =

        Math.cos(φ1) *
        Math.sin(φ2)

        -

        Math.sin(φ1) *
        Math.cos(φ2) *
        Math.cos(Δλ);


    const θ =
        Math.atan2(y, x);


    return normalizeAngle(
        θ * 180 / Math.PI
    );

}


// ==========================================
// DISTANCE CALCULATION
// ==========================================

function calculateDistance(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371000;


    const φ1 =
        lat1 * Math.PI / 180;

    const φ2 =
        lat2 * Math.PI / 180;


    const Δφ =
        (lat2 - lat1) *
        Math.PI / 180;

    const Δλ =
        (lon2 - lon1) *
        Math.PI / 180;


    const a =

        Math.sin(Δφ / 2) *
        Math.sin(Δφ / 2)

        +

        Math.cos(φ1) *
        Math.cos(φ2) *

        Math.sin(Δλ / 2) *
        Math.sin(Δλ / 2);


    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return R * c;

}


// ==========================================
// FORMAT DISTANCE
// ==========================================

function formatDistance(distance) {

    if (distance < 1000) {

        return `${Math.round(distance)} m`;

    }

    return `${(distance / 1000).toFixed(2)} km`;

}


// ==========================================
// DIRECTION NAME
// ==========================================

function getDirectionName(bearing) {

    const directions = [

        "North",
        "North-East",
        "East",
        "South-East",
        "South",
        "South-West",
        "West",
        "North-West"

    ];


    const index =
        Math.round(bearing / 45) % 8;


    return directions[index];

}


// ==========================================
// NORMALIZE ANGLE
// ==========================================

function normalizeAngle(angle) {

    return (
        (angle % 360) +
        360
    ) % 360;

}


// ==========================================
// SECURITY: ESCAPE USER NAME
// ==========================================

function escapeHTML(text) {

    const div =
        document.createElement("div");

    div.textContent = text;

    return div.innerHTML;

}


// ==========================================
// LEAVE ROOM
// ==========================================

leaveButton.addEventListener(
    "click",
    () => {

        if (roomCode && myId) {

            database
                .ref(
                    `rooms/${roomCode}/users/${myId}`
                )
                .remove();

        }


        location.reload();

    }
);