import heapq
import json
from math import asin, cos, radians, sin, sqrt
from pathlib import Path

from graph import load_graph

# Calcula la distancia directa entre dos hospitales usando la fórmula del haversine.
def direct_distance_km(start, end):

    lat1 = radians(start["latitude"]) # Convierte la latitud del hospital de inicio a radianes.
    lon1 = radians(start["longitude"]) # Convierte la longitud del hospital de inicio a radianes.
    lat2 = radians(end["latitude"]) # Convierte la latitud del hospital de destino a radianes.
    lon2 = radians(end["longitude"]) # Convierte la longitud del hospital de destino a radianes.

    lat_difference = lat2 - lat1
    lon_difference = lon2 - lon1

    a = (sin(lat_difference / 2) ** 2 + cos(lat1) * cos(lat2) * sin(lon_difference / 2) ** 2)
    distance = 2 * 6371 * asin(sqrt(a))

    return round(distance, 3)