# Electoral Mapper

Interactive Canadian electoral maps with poll-level detail for past election results, and census overlays for demographic analysis.

You can see it live here: https://www.electoralmaps.ca

# Requirements

* Postgres 16 + PostGIS
* .Net Core (version 8)
* Node.js
* Google Maps API key

# Project Structure

## /vue
The front-end vue.js app.

## /www
The back-end asp.net core web app that provides an API for accessing maps and data.

## /data
Various data import scripts for processing raw data and populating the postgres database.
Since the data processing for this database is mostly adhoc one-offs, these scripts are not intended as a recreation script.

## /gis
Geospatial import scripts.


# License

Copyright (c) 2025 Jacob Zielinski

Licensed under a source-available license. See LICENSE file for details.

# Acknowledgments

Census data is provided by Statistics Canada. 2023. Census Profile. 2021 Census of Population. Statistics Canada Catalogue number 98-316-X2021001. Ottawa. Released November 15, 2023.

Reproduced and distributed on an "as is" basis with the permission of Statistics Canada.