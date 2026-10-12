import json, sys
d = json.load(open(sys.argv[1]))
prev = None
for x in d:
    if x["comando"] != prev:
        nums = [y["numero"] for y in d if y["comando"] == x["comando"]]
        prob = [str(y["numero"]) for y in d if y["comando"] == x["comando"] and y["problema"]]
        print(f"{nums[0]:>3}-{nums[-1]:<3} {'!'+','.join(prob) if prob else '':10} | {x['comando'][:110]!r}")
        prev = x["comando"]
