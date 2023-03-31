# prepare-my-xiso

A script that prepare a directory full of Xbox ISO files to be uploaded to an actual Xbox (first model).

This script will:
- create a single dir for any found game ISO file
- generate the appropriate `default.xbe` (AKA `attach.xbe`) with Title Name and thumbnail
- split big ISO (bigger or equal to 4 GiB) files into half
- save original big ISO files into `_big` dir (backup)

## Usage

Run `node cli.js [path of dir to prepare]`.

## TODO

- Actual CLI options
- Handle errors
- Make split size configurable
- Quiet mode
- Skip `default.xbe` generation
- Regenerate `default.xbe`
- Regenerate splitted ISOs
- Make executables
- More docs
