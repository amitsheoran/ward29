# Ward 29 Pilani - Electoral Information & Community Poll (2026)

A modern, production-quality, mobile-first static website for **Ward 29, Pilani, Rajasthan (नगर पालिका निर्वाचन नामावली, 2026)** with an interactive **Candidate Voting & Live Community Poll** and **Ward 29 WhatsApp Community**.

This portal transforms official civic information and voter data into an accessible, fast, and structured web application with instant voter search, multi-field filtering, statistics visualizations, interactive boundary map, community voting, live poll results, and community chat access.

---

## 🗳️ Ward 29 Candidates & Community Poll

> **Disclaimer**: This is an unofficial community poll for informational purposes only. It is not an official election voting system and these results are not official election results.

### Candidates:
1. **Monika Baloda** - W/O Manish Baloda
2. **Aditi Godara** - W/O Amardeep Godara
3. **Poonam Sihag** - W/O Anil Sihag
4. **Suman** - W/O Tilak
5. **Aruna Madam** - W/O Bhupendra Sheoran

### Community Poll Features:
- **One Vote per User/Session**: Server-side and client-side protection against duplicate votes.
- **Vote Confirmation Dialog**: Prevents accidental taps.
- **Live Real-time Results**: Instant percentage calculation (to 2 decimal places), ranked leaderboard, dynamic current leader tracking (with tie handling), and live SVG donut chart.
- **Supabase Integration**: Ready for Supabase PostgreSQL database with Row Level Security (RLS) policies (`schema.sql`).

---

## 💬 Ward 29 WhatsApp Community

- **Official Invite Link**: [https://chat.whatsapp.com/BVidWwUcejyARy4kaVM4Cb](https://chat.whatsapp.com/BVidWwUcejyARy4kaVM4Cb)
- Allows Ward 29 residents and community members to join the WhatsApp community and receive local updates.

---

## 🏛️ Official Electoral Roll Data (Single Source of Truth)

- **Primary Reference Document**: `input/WardNo29.pdf` (39 Pages)
- **Municipality**: नगर पालिका पिलानी (Pilani), Rajasthan
- **Assembly Constituency**: 25 - पिलानी (25 - Pilani)
- **Ward & Part Number**: Ward 29, Part 1
- **Polling Station**: 29 - गौतम सेकण्डरी स्कूल, पिलानी (Gautam Secondary School, Pilani)
- **Total Voters**: Exactly **901 Total Voters** (463 Male, 438 Female, 0 Third Gender)

---

## 📂 Project Structure

```text
D:\Apps\ward29\
├── index.html                  # Main application single-page portal
├── css/
│   └── style.css               # Mobile-first design system
├── js/
│   └── app.js                  # Search, filter, map, voting & realtime engine
├── data/
│   ├── ward.json               # Ward metadata, boundaries, statistics
│   ├── voters.json             # 901 verified voter records
│   └── candidates.json         # 5 official candidate profiles
├── assets/
│   └── ward-map.png            # High-resolution official Ward 29 map
├── input/
│   └── WardNo29.pdf            # Original 39-page source PDF document
├── schema.sql                  # Supabase database schema & RLS policies
└── README.md                   # Project documentation
```

---

## 🌐 Deploying to GitHub Pages

The repository is hosted at:
```text
https://github.com/amitsheoran/ward29
```

Live website:
```text
https://amitsheoran.github.io/ward29/
```
