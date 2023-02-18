import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { Appbar, Button, Dialog, FAB, IconButton, List, Portal, Provider, TextInput, Title } from 'react-native-paper';
import * as SQLite from 'expo-sqlite';
import * as Location from 'expo-location';

interface DialogiData{
  auki : boolean,
  teksti : string,
  ohje : string
}

interface Muistio{
  id : number,
  tunniste : string,
  ohjeistus : string,
  poimittu : number,
  aikaleima : string,
  lat : number,
  lon : number
}

const db : SQLite.WebSQLDatabase = SQLite.openDatabase("sijainimuistio.db");

db.transaction(
  (tx : SQLite.SQLTransaction) => {
    tx.executeSql(`CREATE TABLE IF NOT EXISTS sijaintimuistio (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  tunniste TEXT,
                  ohjeistus TEXT,
                  poimittu INTEGER,
                  aikaleima DATETIME DEFAULT (datetime('now','localtime')),
                  lat REAL,
                  lon REAL
                )`);
  },
  (err : SQLite.SQLError) => {
    console.log(err);
  }  
);

const App : React.FC = () : React.ReactElement => {

  const [sijainnit, setSijainnit] = useState<Muistio[]>([]);
  const [dialogi, setDialogi] = useState<DialogiData>({
                                                auki : false,
                                                teksti : "",
                                                ohje : ""
                                              });
  const [poistoDialogi, setPoistoDialogi] = useState<boolean>(false);
  const [location, setLocation] = useState<any>();
  const [errorMsg, setErrorMsg] = useState<any>(null);

  const lisaaSijainti = () : void => {
    db.transaction(
      (tx : SQLite.SQLTransaction) => {
        tx.executeSql(`INSERT INTO sijaintimuistio (tunniste, ohjeistus, poimittu, lat, lon) VALUES (?, ?, ?, ?, ?) `, [dialogi.teksti, dialogi.ohje, 0, location.coords.latitude.toFixed(2), location.coords.longitude.toFixed(2)],
       (_tx : SQLite.SQLTransaction, rs : SQLite.SQLResultSet) => {
        haeSijainnit();
       });
      },
      (err : SQLite.SQLError) => console.log(err));

    setDialogi({auki : false, teksti : "", ohje : ""});
  }

  const poimiSijainti = (id : number, tila : number) : void => {

    db.transaction(
      (tx : SQLite.SQLTransaction) => {
        tx.executeSql(`UPDATE sijaintimuistio SET poimittu = ? WHERE id = ? `, [tila, id],
       (_tx : SQLite.SQLTransaction, rs : SQLite.SQLResultSet) => {
        haeSijainnit();
       });
      },
      (err : SQLite.SQLError) => console.log(err));
  }

  const haeSijainnit = () : void => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Lupa sijaintitietojen käyttöön kiellettiin!');
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setLocation(location);
    })();

    db.transaction(
      (tx : SQLite.SQLTransaction) => {
        tx.executeSql(`SELECT * FROM sijaintimuistio`, [],
        (_tx : SQLite.SQLTransaction, rs : SQLite.SQLResultSet) => {
          setSijainnit(rs.rows._array);
        });
      },
      (err : SQLite.SQLError) => console.log(err));

  }

  const poistaSijaintilistasta = () : void => {

    db.transaction(
      (tx : SQLite.SQLTransaction) => {
        tx.executeSql(`DELETE FROM sijaintimuistio WHERE poimittu = 1 `, [],
        (_tx : SQLite.SQLTransaction, rs : SQLite.SQLResultSet) => {
          haeSijainnit();
        });
      },
      (err : SQLite.SQLError) => console.log(err));
      setPoistoDialogi(false);
  }

  useEffect(() => {
    haeSijainnit();
  }, []);

  return (
    <Provider>
      <Appbar.Header>
        <Appbar.Content title="Ot 5: Sijaintimuistio"/>
      </Appbar.Header>
        <ScrollView style={{padding : 20}}>
          <Title>Sijaintimuistiot</Title>
          {(sijainnit.length > 0)
            ? sijainnit.map((sijainti : Muistio, idx : number) =>
             <List.Item
              title={sijainti.tunniste}
              description={`${sijainti.ohjeistus} | ${sijainti.aikaleima} | Lat: ${sijainti.lat} | Lon: ${sijainti.lon}`}
              key={idx}
              left={() => 
                          <IconButton
                            icon={(sijainti.poimittu === 0)?"checkbox-blank-circle-outline":"checkbox-blank-circle"}
                            onPress={() => { poimiSijainti(sijainti.id, (sijainti.poimittu === 0)?1:0) }}
                        />}
              />)
            
            : <Text style={{marginTop: 10, marginBottom: 5}}>Ei sijaintimuistioita.</Text>
          }
          <FAB
            icon="plus"
            color='blue'
            mode='flat'
            variant='primary'
            label='Lisää uusi'
            style={{ alignItems: "center", marginLeft : 60, marginRight : 60, marginTop : 10 }}
            onPress={() => setDialogi({auki : true, teksti : "", ohje : ""})}
          />
          <FAB 
            icon="delete"
            color='red'
            mode='flat'
            variant='tertiary'
            label='Poista valitut'
            style={{ alignItems: "center", marginLeft : 60, marginRight : 60, marginTop : 10, marginBottom : 10}}
            onPress={() => setPoistoDialogi(true)}
          />

          <Portal>
              <Dialog 
                visible={dialogi.auki}
                onDismiss={() => setDialogi({auki : false, teksti : "", ohje : ""})}
              >
                <Dialog.Title>
                  Lisää uusi sijainti
                </Dialog.Title>
                <Dialog.Content>
                  <TextInput
                    label="Tiedot"
                    mode='outlined'
                    placeholder='Kirjaa tunnistetieto...'
                    onChangeText={(teksti : string) => setDialogi({...dialogi, teksti : teksti})}
                  />
                  <TextInput
                    label="Ohjeteksti"
                    mode='outlined'
                    placeholder='Kirjaa lisätiedot...'
                    onChangeText={(ohje : string) => setDialogi({...dialogi, ohje : ohje})}
                  />
                </Dialog.Content>
                <Dialog.Actions>
                  <Button
                    onPress={lisaaSijainti}
                  >Lisää listaan</Button>
                  <Button
                    onPress={() => setDialogi({auki : false, teksti : "", ohje : ""})}
                  >Peruuta</Button>
                </Dialog.Actions>
              </Dialog>
          </Portal>

          <Portal>
            <Dialog
              visible={poistoDialogi}
              onDismiss={() => setPoistoDialogi(false)}
            >
              <Dialog.Title>
                Haluatko varmasti poistaa?
              </Dialog.Title>
              <Dialog.Content>
              {sijainnit.map((sijainti : Muistio, idx : number) =>
                sijainti.poimittu === 1
                  ?<List.Item
                    title={sijainti.tunniste}
                    key={idx}
                  />
                  : null)
              }
              </Dialog.Content>
              <Dialog.Actions>
                <Button
                  onPress={poistaSijaintilistasta}
                >Poista</Button>
                <Button
                  onPress={() => setPoistoDialogi(false)}
                >Peruuta</Button>
              </Dialog.Actions>
            </Dialog>
          </Portal>

        </ScrollView>
      <StatusBar style="auto" />

    </Provider>
  );
}

export default App;