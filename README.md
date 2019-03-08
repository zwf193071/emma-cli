
# emma-cli

A simple CLI for creating your projects
> Author：zwf193071

> E-mail: 997131679@qq.com

> date: 2019/03/08

<!-- ## 特别声明
>  本cli是完全拷贝vue-cli，只是做了非常简单的署名修改，源地址为：https://github.com/vuejs/vue-cli.git 。  如有侵权，请联系我删除。 -->
## Feature
一款轻量的前端CLI工具，目前仅支持create，该项目目前仅作个人学习使用，想深入理解vue-cli实现原理，可从该项目着手

## Usage
全局安装emma-cli。`npm install -g emma-cli`

or
```
git clone https://github.com/zwf193071/emma-cli.git

cd emma-cli && npm install

npm link
```

打开terminal或 cmd ，输入`emma` or `emma -h` ，你将看到如下信息:
```
  Usage: emma <command> [options]

  Options:
    -V, --version                output the version number
    -h, --help                   output usage information

  Commands:
    create [options] <app-name>  create a new project powered by emma-cli-service

    Run emma <command> --help for detailed usage of given command.

```

## Commands
### create <projectName>
这个命令会创建新项目projectName.
```
$ emma create newProject

```

## Thanks to
* [vue-cli](https://github.com/vuejs/vue-cli)







