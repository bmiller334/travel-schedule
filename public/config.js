// It is recommended to restrict your API key in the Google Cloud Console
// to prevent unauthorized use. You can restrict it to specific HTTP referrers (your website's URL).

const CONFIG = {
    // Google Maps API Key
    API_KEY: "AIzaSyCLzmkgE9V4hGbKGXf_eiMe2cqS9RlWKqY", 
    
    // Starting point options for all travel time calculations.
    STARTING_LOCATIONS: {
        shop: "1407 E Oklahoma Ave, Ulysses, KS 67880",
        syracuse: "903 N. Gardner St. Syracuse, KS"
    },

    // Your web app's Firebase configuration
    firebase: {
        apiKey: "AIzaSyC18HE2MgjrUWuN4jwYiTn_B3FvAkA-mtM",
        authDomain: "travel-schedule-53416188-d0011.firebaseapp.com",
        databaseURL: "https://travel-schedule-53416188-d0011-default-rtdb.firebaseio.com",
        projectId: "travel-schedule-53416188-d0011",
        storageBucket: "travel-schedule-53416188-d0011.firebasestorage.app",
        messagingSenderId: "1047914848253",
        appId: "1:1047914848253:web:6dbc215cfb0dcc206b4394"
    }
};
