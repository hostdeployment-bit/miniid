const express = require("express");
const fetch = require("node-fetch").default; // <-- IMPORTANT
const cors = require("cors");
const dotenv = require("dotenv");
const cheerio = require("cheerio");

dotenv.config();

const router = express.Router();
router.use(cors());

// ⭐ PORNHUB SEARCH API
router.get("/search", async (req, res) => {
    try {
        const q = req.query.q;
        if (!q) return res.status(400).json({ error: "Missing ?q=" });

        const searchURL = `https://www.pornhub.com/video/search?search=${encodeURIComponent(q)}`;
        const html = await fetch(searchURL, { 
            headers: { "User-Agent": "Mozilla/5.0" } 
        }).then(r => r.text());

        const $ = cheerio.load(html);
        let results = [];

        $(".js-pop").each((i, el) => {
            const title = $(el).find(".title").text().trim();
            const urlPath = $(el).find("a").attr("href");
            const url = urlPath ? "https://www.pornhub.com" + urlPath : null;
            const thumbnail =
                $(el).find("img").attr("data-thumb_url") ||
                $(el).find("img").attr("src");
            const duration = $(el).find(".duration").text().trim();
            const views = $(el).find(".views").text().trim();

            if (title && url)
                results.push({ title, url, thumbnail, duration, views });
        });

        return res.json({ ok: true, total: results.length, query: q, results });
    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

// ⭐ PORNHUB PARSE API
router.get("/parse", async (req, res) => {
    try {
        const { url } = req.query;
        if (!url) return res.status(400).json({ error: "Missing ?url=" });

        const apiEndpoint =
            process.env.VID_API_ENDPOINT ||
            "https://api-v1.viddownloader.io/video-downloader/video/parse-pornhub";

        const headers = {
            "Content-Type": "application/json",
            "Accept": "*/*",
            "User-Agent": "Render-Node-Downloader/1.0",
            "x-guide": process.env.X_GUIDE || "",
            "fp": process.env.FP || "",
            "fp1": process.env.FP1 || ""
        };

        const response = await fetch(apiEndpoint, {
            method: "POST",
            headers,
            body: JSON.stringify({ url })
        });

        const rawText = await response.text();
        let data;

        try {
            data = JSON.parse(rawText);
        } catch {
            data = { raw: rawText };
        }

        return res.json({
            ok: true,
            api_status: response.status,
            DEVELOP_BY_DEXTER: data
        });

    } catch (err) {
        res.status(500).json({ ok: false, error: err.message });
    }
});

module.exports = router;
