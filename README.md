wplogin
=======

###Install
```
npm install
```

###Test Eventual Success Locally
```
# Will succeed on the 500th request
# Start server locally...
node ./local.js 
# In new terminal...
node ./ -d ./dict.example -v -s5 -r -h 'localhost:3000/500'
```

###Test Eventual Block Locally
```
# Will block incoming requests after 300
# Start server locally...
node ./local.js 
# In new terminal...
node ./ -d ./dict.example -v -s5 -r -h 'localhost:3000/-300'
```

###Test Live Website Using Several Dictionaries in One Folder
```
node ./ -h -d ./~dicts 'http://www.example.com' -u admin -v -s10 -r
```

###To Do
- Adaptive curl timing
- Stricter confirmation that we haven't been blocked and don't know it