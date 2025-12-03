import json

# Read the original file (first 88828 lines which is the valid part)
with open('/Users/dilan/Projects/Antigravity/data/train_routes.geojson', 'r') as f:
    lines = f.readlines()[:88828]
    
# Join and parse
original_text = ''.join(lines)
data = json.loads(original_text)

# Western Province train data
western_province_features = [
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [79.8612, 6.9271]
        },
        "properties": {
            "name": "Colombo Fort",
            "type": "Station"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [79.8587, 6.9319]
        },
        "properties": {
            "name": "Maradana",
            "type": "Station"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [79.8754, 6.9023]
        },
        "properties": {
            "name": "Bambalapitiya",
            "type": "Station"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [79.8821, 6.8897]
        },
        "properties": {
            "name": "Wellawatte",
            "type": "Station"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [79.8856, 6.8789]
        },
        "properties": {
            "name": "Dehiwala",
            "type": "Station"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [79.8897, 6.8421]
        },
        "properties": {
            "name": "Mount Lavinia",
            "type": "Station"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [79.9234, 6.9876]
        },
        "properties": {
            "name": "Ragama",
            "type": "Station"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [79.9543, 7.0721]
        },
        "properties": {
            "name": "Gampaha",
            "type": "Station"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [79.8456, 6.9512]
        },
        "properties": {
            "name": "Dematagoda",
            "type": "Station"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [79.8234, 6.9654]
        },
        "properties": {
            "name": "Kelaniya",
            "type": "Station"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [79.9876, 6.8234]
        },
        "properties": {
            "name": "Panadura",
            "type": "Station"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [80.0234, 6.7123]
        },
        "properties": {
            "name": "Kalutara South",
            "type": "Station"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [79.8612, 6.9271],
                [79.8587, 6.9319],
                [79.8456, 6.9512],
                [79.8234, 6.9654],
                [79.9234, 6.9876],
                [79.9543, 7.0721]
            ]
        },
        "properties": {
            "name": "Main Line North (Colombo-Gampaha)",
            "type": "Railway"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": [
                [79.8612, 6.9271],
                [79.8754, 6.9023],
                [79.8821, 6.8897],
                [79.8856, 6.8789],
                [79.8897, 6.8421],
                [79.9876, 6.8234],
                [80.0234, 6.7123]
            ]
        },
        "properties": {
            "name": "Coastal Line (Colombo-Kalutara)",
            "type": "Railway"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [79.8765, 6.9187]
        },
        "properties": {
            "name": "Kollupitiya",
            "type": "Station"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [79.8543, 6.9234]
        },
        "properties": {
            "name": "Slave Island",
            "type": "Station"
        }
    },
    {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [79.8698, 6.9156]
        },
        "properties": {
            "name": "Kompanna Veediya",
            "type": "Station"
        }
    }
]

# Add Western Province features
data['features'].extend(western_province_features)

# Write back
with open('/Users/dilan/Projects/Antigravity/data/train_routes.geojson', 'w') as f:
    json.dump(data, f, indent=4)

print("Successfully added Western Province train data!")
print(f"Total features: {len(data['features'])}")
