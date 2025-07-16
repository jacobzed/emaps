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
-- Data for Name: map; Type: TABLE DATA; Schema: main; Owner: postgres
--

COPY main.map (id, name, region_id) FROM stdin;
10	2021 Census Dissemination Areas	\N
11	2021 Census Tracts	\N
12	2021 Census Subdivisions	\N
20	2013 Federal Ridings	\N
101	2025 Ontario Polls	\N
102	2024 British Columbia Ridings	\N
103	2024 British Columbia Polls	\N
104	2023 Alberta Ridings	\N
105	2023 Alberta Polls	\N
100	2025 Ontario Ridings	ON
21	2013 Federal Polls	\N
30	2023 Federal Ridings	\N
31	2023 Federal Ridings (City Scale)	\N
32	2023 Federal Ridings (Prov Scale)	\N
33	2023 Federal Ridings (Country Scale)	\N
34	2023 Federal Polls	\N
\.


--
-- Data for Name: region; Type: TABLE DATA; Schema: main; Owner: postgres
--

COPY main.region (abbrev, census_id, name, alt_name, type) FROM stdin;
NL	10	Newfoundland and Labrador	\N	Province
PE	11	Prince Edward Island	\N	Province
NS	12	Nova Scotia	\N	Province
NB	13	New Brunswick	\N	Province
QC	24	Quebec	\N	Province
ON	35	Ontario	\N	Province
MB	46	Manitoba	\N	Province
SK	47	Saskatchewan	\N	Province
AB	48	Alberta	\N	Province
BC	59	British Columbia	\N	Province
NT	61	Northwest Territories	\N	Territory
NU	62	Nunavut	\N	Territory
YT	60	Yukon	\N	Territory
\.


--
-- Data for Name: election; Type: TABLE DATA; Schema: main; Owner: postgres
--

COPY main.election (id, type, date, name, map_id, is_archived, parties, region_id) FROM stdin;
43	F	2019-10-21	43rd General Election	21	f	{Liberal,Conservative,NDP,Bloc,Green}	\N
44	F	2021-09-20	44th General Election	21	f	{Liberal,Conservative,NDP,Bloc,Green}	\N
45	F	2025-04-28	45th General Election	34	t	\N	\N
1000	P	2025-02-27	44th Parliament of Ontario	101	f	{Liberal,Conservative,NDP}	ON
1001	P	2019-10-19	43rd Parliament of British Columbia	103	t	{Conservative,NDP,Green}	BC
1002	P	2023-05-29	31st Legislature	\N	f	\N	AB
\.


--
-- Name: election_id_seq; Type: SEQUENCE SET; Schema: main; Owner: postgres
--

SELECT pg_catalog.setval('main.election_id_seq', 1000, true);


--
-- PostgreSQL database dump complete
--

