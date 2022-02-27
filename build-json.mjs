import * as fs from 'fs';
import { argv } from 'process';

const init_data = fs.readFileSync(new URL('./data/init_data.txt', import.meta.url), 'utf8')
const master_toy_friend = fs.readFileSync(new URL('./data/master_toy_friend.txt', import.meta.url), 'utf8')
const initDataJson = JSON.parse(init_data);
const masterToyFriendJson = JSON.parse(master_toy_friend);
const friends = initDataJson["masters"]["friends"]
for(const friend of friends) {
    for(const [k, v] of Object.entries(friend)) {
        const includeProps = [
            "id", 
            "name", 
            "name_en",
        ]
        const e = includeProps.find((s) => s == k)
        if(e == undefined) {
            delete friend[k]
        }
    }
}

const toys = initDataJson["masters"]["toys"]
for(const toy of toys) {
    for(const [k, v] of Object.entries(toy)) {
        const includeProps = [
            "id", 
            "name", 
        ]
        const e = includeProps.find((s) => s == k)
        if(e == undefined) {
            delete toy[k]
        }
    }
}

const friend_motion_extends = initDataJson["masters"]["friend_motion_extends"]
for(const extend of friend_motion_extends) {
    for(const [k, v] of Object.entries(extend)) {
        const includeProps = [
            "id", 
            "friend_id",
            "toy_visible",
            "name", 
        ]
        const e = includeProps.find((s) => s == k)
        if(e == undefined) {
            delete extend[k]
        }
    }
}

const dirents2 = fs.readdirSync(new URL('./dist/GameObject', import.meta.url), { withFileTypes: true });
const names = dirents2
    .filter(dirent => dirent.isDirectory())
    .map(({ name }) => name)
const models2 = []
for(const name of names) {
    const dirents3 = fs.readdirSync(new URL('./dist/GameObject/' + name, import.meta.url), { withFileTypes: true });
    for(const dirent3 of dirents3)
    if(dirent3.isFile() && dirent3.name.endsWith(".fbx")) {
        models2.push({ name: './GameObject/' + name + "/" + dirent3.name })
    }
}

const result = {
    toys,
    friends,
    friend_motion_extends,
    models: models2,
};
fs.writeFileSync(new URL('./dist/index.json', import.meta.url), JSON.stringify(result, null, '\t'));
