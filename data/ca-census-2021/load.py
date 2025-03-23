import sys, os, csv, re, glob

def load(fname, transform, file_mode = 'w'):
    print('Loading', fname)
    rows = 0
    count = 0
    census_id = 1
    dupes = set()
    with (
        open(fname, 'r') as inf,
        open('import-data.csv', file_mode, newline='') as dataf,
        open('import-trait.csv', file_mode, newline='') as traitf,
        open('import-geo.csv', file_mode, newline='') as geof,
        open('import.sql', 'w') as sql
    ):

        # create temp tables so we can avoid duplicate insertions since the /copy command
        # does not support ON CONFLICT DO NOTHING
        sql.write("create temp table tmp_trait as select * from census_trait with no data; \n")
        sql.write("\\copy tmp_trait (census_id, id, name) from import-trait.csv with (format csv);\n")
        sql.write("insert into census_trait select * from tmp_trait on conflict do nothing;\n")

        sql.write("create temp table temp_geo as select * from census_geo with no data; \n")
        sql.write("\\copy temp_geo (census_id, type, id, name) from import-geo.csv with (format csv);\n")
        sql.write("insert into census_geo select * from temp_geo on conflict do nothing;\n")

        sql.write("create temp table temp_data as select * from census_data with no data; \n")
        sql.write("\\copy temp_data (census_id, trait_id, geo_type, geo_id, value, rate) from import-data.csv with (format csv);\n")
        sql.write("insert into census_data select * from temp_data on conflict do nothing;\n")

        reader = csv.DictReader(inf)
        data_writer = csv.writer(dataf)
        trait_writer = csv.writer(traitf)
        geo_writer = csv.writer(geof)
        for row in reader:
            rows += 1
            #if rows % 5000 == 1:
            if rows == 1:
                # print a sample row
                for k, v in row.items():
                    print(f'... {k}={v}')

            row = transform(row)
            if row is not None:
                count += 1

                # trait and geo tables are dupe-checked because they mostly contain duplicate values
                # and checking them here is faster than ignoring the dupes with "on conflict do nothing" in postgres

                # output columns in same order as "data" table
                data_row = (census_id, row['CHARACTERISTIC_ID'], row['GEO_LEVEL'], row['ALT_GEO_CODE'], row['C1_COUNT_TOTAL'], row['C10_RATE_TOTAL'])
                data_writer.writerow(data_row)

                # output columns in same order as "trait" table
                trait_row = (census_id, row['CHARACTERISTIC_ID'], row['CHARACTERISTIC_NAME'])
                if hash(trait_row) not in dupes:
                    dupes.add(hash(trait_row))
                    trait_writer.writerow(trait_row)

                # output columns in same order as "geo" table
                geo_row = (census_id, row['GEO_LEVEL'], row['ALT_GEO_CODE'], row['GEO_NAME'])
                if hash(geo_row) not in dupes:
                    dupes.add(hash(geo_row))
                    geo_writer.writerow(geo_row)


    print(count, 'rows prepared, run psql -d census -f import.sql')

# psql -d census -f import.sql


# provinces (also includes country)
def filter_prov(row):
    if row['GEO_LEVEL'] == 'Territory':
        row['GEO_LEVEL'] = 'Province'
    return row
load('98-401-X2021001_English_CSV_data.csv', filter_prov)

# federal ridings (also includes country and provinces)
def filter_federal_ridings(row):
    if row['GEO_LEVEL'] == 'Federal electoral district (2023 Representation Order)':
        row['GEO_LEVEL'] = 'ED'
        return row
    return None
#load('98-401-X2021029_English_CSV_data.csv', filter_federal_ridings)

# subdivisions (cities, towns, etc.)
def filter_subdivision(row):
    # subdivisions have a type suffix in parentheses
    # e.g. "Cobourg, Town (T)"
    type = re.match(r'.*\((\w+)\)$', row['GEO_NAME'])
    if row['GEO_LEVEL'] == 'Census subdivision' and type is not None and type.group(1) in ['C', 'CY', 'DM', 'T', 'TP', 'MU']:
        row['GEO_LEVEL'] = 'SD'
        return row
    return None
#load('98-401-X2021003_English_CSV_data.csv', filter_subdivision)

# dissemination areas
def filter_da(row):
    if row['GEO_LEVEL'] == 'Dissemination area':
        row['GEO_LEVEL'] = 'DA'
        return row
    return None
da = glob.glob('98-401-X2021006_English_CSV_data*.csv')
#for i, f in enumerate(da):
#    load(f, filter_da, 'w' if i == 0 else 'a')
