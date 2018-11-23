const path = require('path');
const inquirer = require('inquirer');
const kebabCase = require('lodash.kebabcase');
const template = require('lodash.template');
const { promisify } = require('util');
const glob = promisify(require('glob'));
const rimraf = promisify(require('rimraf'));
const mkdir = promisify(require('fs').mkdir);
const readFile = promisify(require('fs').readFile);
const writeFile = promisify(require('fs').writeFile);

function isNotEmpty(input) {
  return input.length > 0 || 'should not be empty';
}

inquirer.prompt([
  {
    name: 'proposalName',
    message: 'Proposal name:',
    validate: isNotEmpty,
  },
  {
    name: 'nickname',
    message: 'Your GitHub nickname:',
    validate: isNotEmpty,
  },
  {
    name: 'fullname',
    message: 'Your full name:',
    validate: isNotEmpty,
  },
  {
    name: 'email',
    message: 'Your email:',
    validate: isNotEmpty,
  },
  {
    name: 'spec',
    message: 'Do you want to generate spec template and CI configuration for deployment?',
    type: 'confirm',
    default: true,
  },
]).then(({ proposalName, nickname, fullname, email, spec }) => {
  const cwd = process.cwd();
  const proposalNameHyphen = `proposal-${kebabCase(proposalName)}`;
  const directory = path.join(cwd, proposalNameHyphen);
  mkdir(directory)
    .catch(e => {
      if (e.code === 'EEXIST') {
        return inquirer.prompt([
          {
            name: 'overwrite',
            message: `Directory ${directory} already exists. Do you want to overwrite it?`,
            type: 'confirm',
            default: false,
          }
        ]);
      } else throw e;
    }).then(answers => {
      if (!answers || answers.overwrite) {
        return rimraf(directory)
          .then(() => mkdir(directory))
          .then(() => {
            if (spec) {
              return Promise.all([
                glob(path.join(__dirname, 'templates/base/*')),
                glob(path.join(__dirname, 'templates/additional/*')),
              ]).then(files => [].concat(...files));
            } else {
              return glob(path.join(__dirname, 'templates/base/*'));
            }
          })
          .then(files => Promise.all(
            files
              .map(file => readFile(file, 'utf8')
                .then(text => {
                  if (path.basename(file) !== 'deploy.sh') {
                    const compile = template(text);
                    return compile({
                      proposalName,
                      proposalNameHyphen,
                      fullname,
                      nickname,
                      email,
                    });
                  } else return text;
                })
                .then(text => {
                  const filePath = path.join(directory, path.basename(file));
                  return writeFile(filePath, text, 'utf8');
                })
              ))
          )
          .then(() => {
            console.log('done');
          });
      }
    });
});
