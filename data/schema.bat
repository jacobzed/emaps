pg_dump -U postgres -d census2 --schema-only --create -f schema.sql
pg_dump -U postgres --data-only -t map -t election -t region census2 > data.sql