const path = require("path");
const express = require("express");
const bodyParser = require("body-parser");
const app = express();
require("dotenv").config({ path: path.resolve(__dirname, 'credentialsDontPost/.env') });
const uri = process.env.MONGO_CONNECTION_STRING;
const { MongoClient, ServerApiVersion } = require('mongodb');
const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTION};

app.set("views", path.resolve(__dirname, "templates"));
app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({extended:false}));

const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });

const portNumber = 4444;
let slicedResult;
let ret;

process.stdin.setEncoding("utf8");
if (process.argv.length != 2) {
    process.stdout.write(`Usage: node spotify.js\n`);
    process.exit(1);
}

process.stdout.write(`Web server started and running at http://localhost:${portNumber}\n`);
const prompt = "Stop to shutdown the server: ";
process.stdout.write(prompt);
process.stdin.on("readable", function () {
    const dataInput = process.stdin.read();
    if (dataInput !== null) {
        const command = dataInput.trim();
        if (command === "stop") {
            process.stdout.write("Shutting down the server\n");
            process.exit(0);
        }
    }
});

app.get("/", async (request, response) => {
    const url = 'https://spotify-most-listened-songs.p.rapidapi.com/mnlwmM/50_most_spotify_listened_songs_of_2023';
    const options = {
        method: 'GET',
        headers: {
            'X-RapidAPI-Key': '0b28a69429msh8d2ef8c4a60f965p1b2362jsn02c8fa8fdb90',
            'X-RapidAPI-Host': 'spotify-most-listened-songs.p.rapidapi.com'
        }
    };
    try {
        const res = await fetch(url, options);
        const result = await res.json();
        slicedResult = result.slice(0, 50);
        ret = `<table border="1"><tr><th>Ranking</th><th>Song</th><th>Artist(s)</th><th>Streams</th></tr>`;
        slicedResult.forEach((e) => {
            ret += `<tr><td>${e.id}</td><td>${e.track_name}</td><td>${e["artist(s)_name"]}</td><td>${e.streams}</td>`;
        });
        ret += `</table>`;
    } catch (error) {
        console.error(error);
    }
    response.render("index", {table: ret});
});

app.get("/addToPlaylist", (request, response) => {
    response.render("addToPlaylist");
});

app.post("/addToPlaylist", async (request, response) => {
    let {songname} = request.body;
    let song_details = await insertSong(client, songname);
    const variables = {
        rank: song_details.id,
        song: song_details.track_name,
        artist: song_details['artist(s)_name'],
        streams: song_details.streams
    }
    response.render("viewAddedSong", variables);
});

app.get("/viewPlaylist", async (request, response) => {
    let song_arr = await findAllSongs(client);
    let table = `<table border="1"><tr><th>Ranking</th><th>Song</th><th>Artist(s)</th><th>Streams</th></tr>`;
    song_arr.forEach((e) => {
        table += `<tr><td>${e.id}</td><td>${e.track_name}</td><td>${e["artist(s)_name"]}</td><td>${e.streams}</td>`;
    });
    table += `</table>`;
    response.render("viewPlaylist", {table: table});
});

app.get("/remove", (request, response) => {
    response.render("removeFromPlaylist");
});

app.post("/removeOne", async (request, response) => {
    let {songname} = request.body;
    const song_details = await deleteOneSong(client, songname);
    const variables = {
        rank: song_details.id,
        song: song_details.track_name,
        artist: song_details['artist(s)_name'],
        streams: song_details.streams
    }
    response.render("viewRemovedSong", variables);
});

app.post("/removeAll", async (request, response) => {
    const numDeleted = await deleteAllSongs(client);
    response.render("index", {table: ret});
});

async function insertSong(client, song) {
    try {
        await client.connect();
        let song_details = slicedResult.find((ele) => ele.track_name === song);
        const result = await client.db(process.env.MONGO_DB_NAME).collection(process.env.MONGO_COLLECTION).insertOne(song_details);
        await client.close();
        return song_details;
    }
    catch (e) {
        console.error(e);
    }
}

async function findAllSongs(client) {
    try {
        await client.connect();
        const result = await client.db(process.env.MONGO_DB_NAME)
                            .collection(process.env.MONGO_COLLECTION)
                            .find({});
        const arr = await result.toArray();
        await client.close()
        return arr;
    }
    catch (e) {
        console.error(e);
    }
}

async function deleteOneSong(client, song) {
    try {
        await client.connect();
        let song_details = slicedResult.find((ele) => ele.track_name === song);
        let filter = {track_name: song};
        const result = await client.db(process.env.MONGO_DB_NAME).collection(process.env.MONGO_COLLECTION).deleteOne(filter);
        await client.close();
        return song_details;
    }
    catch (e) {
        console.error(e);
    }
}

async function deleteAllSongs(client) {
    try {
        await client.connect();
        const result = await client.db(process.env.MONGO_DB_NAME)
                            .collection(process.env.MONGO_COLLECTION)
                            .deleteMany({});
        await client.close()
        return result.deletedCount;
    }
    catch (e) {
        console.error(e);
    }
}

app.listen(portNumber);