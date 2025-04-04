import requests, re

f = open('44th.html')
html = f.read()

# https://www.elections.ca/res/rep/off/ovr2021app/53/data_donnees/pollresults_resultatsbureau10001.csv
site = 'https://www.elections.ca'
matches = re.findall(r'/res/rep/off/ovr2021app/53/data_donnees/pollresults_resultatsbureau[^"]+', html)

for url in matches:
    name = url.split('/')[-1]
    print(url)
    r = requests.get(site + url)
    f = open(name, 'w')
    f.write(r.text)
    f.close()




