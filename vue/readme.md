
# Installation

This folder contains the front-end interface for the site written in vue.js.

Copy ```.env.example``` to ```.env```

You will need to acquire a google maps API key via https://console.google.com and update VITE_GOOGLE_MAPS_API_KEY setting with your key.

To build for the first time install required packages:

```npm install```


# Developement

In order to run this you will need to launch the API backend from the www folder.

Once the back end is running you can run the front-end using:

```npm run dev```


# Production

To build the production version, which copies index.js and index.css over to ..\www\wwwroot\static run:

```npm run build```
