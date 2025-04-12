--
-- PostgreSQL database dump
--

-- Dumped from database version 16.3
-- Dumped by pg_dump version 16.3

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: census2; Type: DATABASE; Schema: -; Owner: postgres
--

CREATE DATABASE census2 WITH TEMPLATE = template0 ENCODING = 'UTF8' LOCALE_PROVIDER = libc LOCALE = 'en_US.UTF-8';


ALTER DATABASE census2 OWNER TO postgres;

\connect census2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: census2; Type: DATABASE PROPERTIES; Schema: -; Owner: postgres
--

ALTER DATABASE census2 SET search_path TO '$user', 'main', 'public';


\connect census2

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: etl; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA etl;


ALTER SCHEMA etl OWNER TO postgres;

--
-- Name: main; Type: SCHEMA; Schema: -; Owner: postgres
--

CREATE SCHEMA main;


ALTER SCHEMA main OWNER TO postgres;

--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: census; Type: TABLE; Schema: main; Owner: postgres
--

CREATE TABLE main.census (
    id integer NOT NULL,
    description text NOT NULL,
    year integer NOT NULL,
    is_archived boolean DEFAULT false NOT NULL
);


ALTER TABLE main.census OWNER TO postgres;

--
-- Name: census_data; Type: TABLE; Schema: main; Owner: postgres
--

CREATE TABLE main.census_data (
    census_id integer NOT NULL,
    trait_id integer NOT NULL,
    geo_type text NOT NULL,
    geo_id text NOT NULL,
    value numeric(10,2),
    rate numeric(10,2)
);


ALTER TABLE main.census_data OWNER TO postgres;

--
-- Name: census_geo; Type: TABLE; Schema: main; Owner: postgres
--

CREATE TABLE main.census_geo (
    census_id integer NOT NULL,
    type text NOT NULL,
    id text NOT NULL,
    name text
);


ALTER TABLE main.census_geo OWNER TO postgres;

--
-- Name: census_trait; Type: TABLE; Schema: main; Owner: postgres
--

CREATE TABLE main.census_trait (
    census_id integer NOT NULL,
    id integer NOT NULL,
    name text NOT NULL,
    description text,
    category text,
    is_rate boolean DEFAULT true NOT NULL,
    is_hidden boolean DEFAULT false NOT NULL
);


ALTER TABLE main.census_trait OWNER TO postgres;

--
-- Name: election; Type: TABLE; Schema: main; Owner: postgres
--

CREATE TABLE main.election (
    id integer NOT NULL,
    type text NOT NULL,
    date date NOT NULL,
    name text,
    map_id integer,
    is_archived boolean DEFAULT false NOT NULL,
    parties text[],
    region_id text
);


ALTER TABLE main.election OWNER TO postgres;

--
-- Name: election_data; Type: TABLE; Schema: main; Owner: postgres
--

CREATE TABLE main.election_data (
    election_id integer NOT NULL,
    region_id text NOT NULL,
    ed_id text NOT NULL,
    va_id text,
    category text,
    party text NOT NULL,
    candidate text,
    votes integer NOT NULL,
    merged_id text,
    pct numeric(6,3),
    margin numeric(6,3)
);


ALTER TABLE main.election_data OWNER TO postgres;

--
-- Name: election_id_seq; Type: SEQUENCE; Schema: main; Owner: postgres
--

ALTER TABLE main.election ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME main.election_id_seq
    START WITH 1000
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: map; Type: TABLE; Schema: main; Owner: postgres
--

CREATE TABLE main.map (
    id integer NOT NULL,
    name text NOT NULL
);


ALTER TABLE main.map OWNER TO postgres;

--
-- Name: map_shp; Type: TABLE; Schema: main; Owner: postgres
--

CREATE TABLE main.map_shp (
    map_id integer NOT NULL,
    id text NOT NULL,
    name text,
    attribs jsonb,
    geom public.geometry(Geometry,4326) NOT NULL,
    region_id text
);


ALTER TABLE main.map_shp OWNER TO postgres;

--
-- Name: profile_id_seq; Type: SEQUENCE; Schema: main; Owner: postgres
--

ALTER TABLE main.census ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME main.profile_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: region; Type: TABLE; Schema: main; Owner: postgres
--

CREATE TABLE main.region (
    abbrev text NOT NULL,
    census_id text,
    name text NOT NULL,
    alt_name text,
    type text NOT NULL
);


ALTER TABLE main.region OWNER TO postgres;

--
-- Name: census_data census_data_pkey; Type: CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.census_data
    ADD CONSTRAINT census_data_pkey PRIMARY KEY (census_id, geo_type, geo_id, trait_id);


--
-- Name: election election_pkey; Type: CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.election
    ADD CONSTRAINT election_pkey PRIMARY KEY (id);


--
-- Name: census_geo geo_pkey; Type: CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.census_geo
    ADD CONSTRAINT geo_pkey PRIMARY KEY (census_id, type, id);


--
-- Name: map map_pkey; Type: CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.map
    ADD CONSTRAINT map_pkey PRIMARY KEY (id);

ALTER TABLE main.map CLUSTER ON map_pkey;


--
-- Name: map_shp map_shp_pkey; Type: CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.map_shp
    ADD CONSTRAINT map_shp_pkey PRIMARY KEY (id, map_id);


--
-- Name: census profile_pkey; Type: CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.census
    ADD CONSTRAINT profile_pkey PRIMARY KEY (id);


--
-- Name: region region_pkey; Type: CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.region
    ADD CONSTRAINT region_pkey PRIMARY KEY (abbrev);


--
-- Name: census_trait trait_pkey; Type: CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.census_trait
    ADD CONSTRAINT trait_pkey PRIMARY KEY (id, census_id);


--
-- Name: idx_census_data_filter; Type: INDEX; Schema: main; Owner: postgres
--

CREATE INDEX idx_census_data_filter ON main.census_data USING btree (census_id, trait_id, geo_type, geo_id);


--
-- Name: idx_election_data; Type: INDEX; Schema: main; Owner: postgres
--

CREATE INDEX idx_election_data ON main.election_data USING btree (election_id, ed_id, va_id);


--
-- Name: idx_election_data_filter; Type: INDEX; Schema: main; Owner: postgres
--

CREATE INDEX idx_election_data_filter ON main.election_data USING btree (election_id, (((ed_id || '-'::text) || va_id)));


--
-- Name: idx_map_shp_map_id_geom; Type: INDEX; Schema: main; Owner: postgres
--

CREATE INDEX idx_map_shp_map_id_geom ON main.map_shp USING gist (geom);


--
-- Name: census_geo fkey_census; Type: FK CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.census_geo
    ADD CONSTRAINT fkey_census FOREIGN KEY (census_id) REFERENCES main.census(id) NOT VALID;


--
-- Name: census_trait fkey_census; Type: FK CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.census_trait
    ADD CONSTRAINT fkey_census FOREIGN KEY (census_id) REFERENCES main.census(id) NOT VALID;


--
-- Name: census_data fkey_census; Type: FK CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.census_data
    ADD CONSTRAINT fkey_census FOREIGN KEY (census_id) REFERENCES main.census(id) MATCH FULL ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: election_data fkey_election; Type: FK CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.election_data
    ADD CONSTRAINT fkey_election FOREIGN KEY (election_id) REFERENCES main.election(id) ON UPDATE CASCADE ON DELETE CASCADE NOT VALID;


--
-- Name: census_data fkey_geo; Type: FK CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.census_data
    ADD CONSTRAINT fkey_geo FOREIGN KEY (census_id, geo_type, geo_id) REFERENCES main.census_geo(census_id, type, id) MATCH FULL ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: map_shp fkey_map; Type: FK CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.map_shp
    ADD CONSTRAINT fkey_map FOREIGN KEY (map_id) REFERENCES main.map(id) MATCH FULL ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: election fkey_map; Type: FK CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.election
    ADD CONSTRAINT fkey_map FOREIGN KEY (map_id) REFERENCES main.map(id) ON UPDATE CASCADE ON DELETE SET NULL NOT VALID;


--
-- Name: election fkey_region; Type: FK CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.election
    ADD CONSTRAINT fkey_region FOREIGN KEY (region_id) REFERENCES main.region(abbrev) NOT VALID;


--
-- Name: census_data fkey_trait; Type: FK CONSTRAINT; Schema: main; Owner: postgres
--

ALTER TABLE ONLY main.census_data
    ADD CONSTRAINT fkey_trait FOREIGN KEY (census_id, trait_id) REFERENCES main.census_trait(census_id, id) MATCH FULL ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

