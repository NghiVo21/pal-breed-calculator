import pandas as pd
import json

df = pd.read_excel('pal.xlsx', header=None)

graph_data = {}
name_id_map = {}
id_name_map = {}

for i in df.index[2:]:
    entity_id = str(i - 1)
    entity_name = df.at[i, 1]
    name_id_map[entity_name] = entity_id
    id_name_map[entity_id] = entity_name

for j in df.columns[2:]:
    entity_id = str(j - 1)
    entity_name = df.at[1, j]
    name_id_map[entity_name] = entity_id
    id_name_map[entity_id] = entity_name

for i in df.index[2:]:
    entity1_id = str(i - 1)
    for j in df.columns[2:]:
        result_name = df.at[i, j]
        if pd.notna(result_name):
            if result_name not in name_id_map:
                current_id = str(len(name_id_map) + 1)
                name_id_map[result_name] = current_id
                id_name_map[current_id] = result_name
            result_entity_id = name_id_map[result_name]
            
            entity2_id = str(j - 1)
            
            if entity1_id not in graph_data:
                graph_data[entity1_id] = {}
            if result_entity_id not in graph_data[entity1_id]:
                graph_data[entity1_id][result_entity_id] = []
            if entity2_id not in graph_data[entity1_id][result_entity_id]:
                graph_data[entity1_id][result_entity_id].append(entity2_id)

with open('graph_data.json', 'w') as json_file:
    json.dump(graph_data, json_file, indent=4)

with open('id_name_map.json', 'w') as json_file:
    json.dump(id_name_map, json_file, indent=4)

print('Excel data has been converted to graph_data.json and id_name_map.json')
