import json
import time
from math import asin, cos, radians, sin, sqrt
from pathlib import Path
from urllib.request import Request, urlopen

data_folder = Path(__file__).resolve().parent / "data"
connections_path = data_folder / "connections.json"

def direct_distance_km(start, end):

    # Convertir las coordenadas de grados a radianes.
    lat1 = radians(start["latitude"])
    lon1 = radians(start["longitude"])
    lat2 = radians(end["latitude"])
    lon2 = radians(end["longitude"])

    # Fórmula de Haversine: distancia en línea recta.
    lat_difference = lat2 - lat1
    lon_difference = lon2 - lon1

    a = (sin(lat_difference / 2) ** 2 + cos(lat1) * cos(lat2) * sin(lon_difference / 2) ** 2)
    
    earth_radius_km = 6371
    distance = 2 * earth_radius_km * asin(sqrt(a))

    return round(distance, 1) # Redondear a 1 decimal para que sea más legible.


def road_distance_km(start, end):

    # OSRM (Open Source Routing Machine) recibe las coordenadas en orden: longitud, latitud.
    start_coords = f'{start["longitude"]},{start["latitude"]}'
    end_coords = f'{end["longitude"]},{end["latitude"]}'

    url = ("https://router.project-osrm.org/route/v1/driving/" f"{start_coords};{end_coords}" "?overview=false&steps=false")

    # Se pide a OSRM una ruta en automóvil entre los dos hospitales.
    request = Request(url, headers={"User-Agent": "bogota-hospital-search/1.0"})

    with urlopen(request, timeout=30) as response:
        result = json.load(response)

    if result.get("code") != "Ok" or not result.get("routes"):
        raise ValueError("OSRM no encontró una ruta entre los hospitales")

    # OSRM entrega metros, el JSON guarda kilómetros, por lo que se divide entre 1000 y se redondea a 1 decimal.
    distance_meters = result["routes"][0]["distance"]
    return round(distance_meters / 1000, 1)


def main():

    # Leer la lista de hospitales.
    with (data_folder / "hospitals.json").open(encoding="utf-8") as file:
        hospital_list = json.load(file)

    # Crear un diccionario para buscar cada hospital por su ID.
    hospitals = {}

    for hospital in hospital_list:
        hospitals[hospital["id"]] = hospital

    # Leer las conexiones del grafo.
    with connections_path.open(encoding="utf-8") as file:
        connections = json.load(file)

    for connection in connections:
        source_id = connection["source"]
        target_id = connection["target"]

        source_hospital = hospitals[source_id]
        target_hospital = hospitals[target_id]

        # La distancia directa es la misma de ida y de vuelta.
        connection["direct_distance_km"] = direct_distance_km(source_hospital, target_hospital)

        # Calcular la ida si todavía no tiene distancia.
        if connection.get("distance_forward_km") is None:
            connection["distance_forward_km"] = road_distance_km(
                source_hospital, target_hospital)
            time.sleep(2) # Esperar 2 segundos para no saturar el servicio de OSRM.

        # Calcular la vuelta si todavía no tiene distancia.
        if connection.get("distance_backward_km") is None:
            connection["distance_backward_km"] = road_distance_km(
                target_hospital, source_hospital)
            time.sleep(2) # Esperar 2 segundos para no saturar el servicio de OSRM.

        print(
            "Origen:", source_id,
            "Destino:", target_id,
            "Distancia directa:", connection["direct_distance_km"], "km",
            "Distancia de ida:", connection["distance_forward_km"], "km",
            "Distancia de vuelta:", connection["distance_backward_km"], "km",
            flush = True # Asegura que se imprima inmediatamente en la consola, útil para seguimiento en tiempo real.
        )

    # Preparar el JSON completo antes de reemplazar el original.
    temporary_path = data_folder / "connections.tmp"

    with temporary_path.open("w", encoding="utf-8") as file:
        json.dump(connections, file, ensure_ascii=False, indent=2)
        file.write("\n")

    temporary_path.replace(connections_path)
    print("Distancias guardadas en data/connections.json")


# Ejecutar main solamente al correr este archivo.
if __name__ == "__main__":
    main()