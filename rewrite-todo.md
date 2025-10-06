# TODO Checklist for the rewrite into python

## Core

- [ ] Discord.py
- [ ] Client initialization
- [ ] Logger
  - Destination: CMD/Log
    - [ ] Info
    - [ ] Error?
  - Destination: Discord Channel
    - [ ] Info
    - [ ] Error?
- [ ] Command Handler

## Interactions

- [ ] New member
- [ ] Message Delete
- [ ] Message Update

#### Buttons

- [ ] Approve Guests
- [ ] Approve Member
- [ ] Cancel Approval

## Utilities

In discord.js, commands are usually arranged in their own file in folder (mostly guidelines that everyone follows), discord.py uses Cogs that can have multiple commands in it sort of like a group/list.

- [ ] Load Commands (Cogs)
- [ ] Update Commands (Cogs)
- [ ] Access Token Refresher (Sheets API)
- [ ] Update Commands (just executes the update commands from utils)
- [ ] Edit Message

## Commands

- [ ] Ping
- [ ] Say
- [ ] Announce
- [ ] Register (Could be deprecated)
- [ ] Sign-Up

## CICD

These are mostly checking if they will still work with python, since some of them do not care what language is being used.

- [ ] Webhook
- [ ] Redeploy Script
- [ ] Docker/Singularity Configurations
- [ ] Docker/Singularity Runner
