import sys, os, csv, re, glob

sql = open('import.sql', 'w')
sql.write("""
create temp table tmp_ed as select * from election_data with no data;

\\copy tmp_ed (election_id, region_id, ed_id, va_id, category, candidate, party, votes, merged_id) from import-data.csv with (format csv);

update tmp_ed set party = 'NDP' where party = 'NDP-New Democratic Party';
update tmp_ed set party = 'Green' where party = 'Green Party';
update tmp_ed set party = 'Bloc' where party = 'Bloc Québécois';
update tmp_ed set party = 'Other', candidate = null where not party in ('Conservative', 'Liberal', 'NDP', 'Green', 'Bloc');
--delete from tmp_ed where merged_id is not null;

delete from election_data where election_id = 44;

-- some polls may have multiple rows
insert into election_data (election_id, region_id, ed_id, va_id, candidate, party, votes, merged_id)
select election_id, region_id, ed_id, va_id, candidate, party, sum(votes), merged_id
from tmp_ed
group by election_id, region_id, ed_id, va_id, candidate, party, merged_id
on conflict do nothing;

-- calculate the percentage of votes for each candidate
with x as (
    select election_id, ed_id, va_id, sum(votes) as total
    from election_data
    group by election_id, ed_id, va_id
    where election_id = 44
)
update election_data ed
set pct = votes::numeric / total
from x
where ed.election_id = x.election_id and ed.ed_id = x.ed_id and ed.va_id = x.va_id
and ed.election_id = 44
and total > 0;

-- calc margin of victory
update election_data ed
set margin = pct - (select max(pct) from election_data x where ed.election_id = x.election_id and ed.ed_id = x.ed_id and ed.va_id = x.va_id and ed.party <> x.party)
where ed.election_id = 44;

-- copy results to merged polls
update election_data ed
set pct = (select pct from election_data where election_id = ed.election_id and ed_id = ed.ed_id and va_id = ed.merged_id and party = ed.party and pct > 0)
where election_id = 44
and merged_id is not null;

""")

sql.close()

dataf = open('import-data.csv', 'w', newline='')
writer = csv.writer(dataf)

def parse_prov(id):
    """ convert a federal riding code to a province abbreviation """
    abbrev = ['BC', 'AB', 'SK', 'MB', 'ON', 'QC', 'NB', 'NS', 'PE', 'NL', 'YT', 'NU', 'NT']
    codes  = ['59', '48', '47', '46', '35', '24', '13', '12', '11', '10', '60', '61', '62']
    return abbrev[codes.index(id[:2])]

def format_poll(id):
    # polls can have suffixes when split by location
    return re.sub(r'[^\d]', '', id)

def load(fname):
    print('Loading', fname)
    rows = 0
    count = 0
    with open(fname, 'r') as inf:
        reader = csv.reader(inf)
        header = next(reader)

        for row in reader:
            # the files are full of empty rows
            if len(row) == 0:
                continue

            # print a sample row
            # rows += 1
            # if rows == 1:
            #     for i, k in enumerate(header):
            #         print(f'... {k}={row[i]}')
            #     continue

            election = '44'
            ed = row[0]
            region = parse_prov(ed)
            poll = format_poll(row[3])
            candidate = row[12] + ' ' + row[10]
            party = row[13]
            votes = int(row[17])
            merged = format_poll(row[7])
            void = row[5]

            # void votes all seem to be zeroed
            # if void == 'Y':
            #     print(f'voided {row}')

            # not sure what to make of these - there are very few of them
            if merged and votes > 0:
                print(row)
                continue

            data_row = (election, region, ed, poll, '', candidate, party, votes, merged)
            writer.writerow(data_row)
            count += 1


    print(count, 'rows prepared, run psql -d census -f import.sql')


files = glob.glob('pollresults_*.csv')
for f in files:
    load(f)


