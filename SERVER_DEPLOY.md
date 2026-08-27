# 评分系统服务器部署说明

这版已经从纯前端演示版改为“前端 + Node 后端 + 文件数据存储”的真实部署版。

## 服务器要求

- Ubuntu 20.04/22.04/24.04
- Node.js 18 或以上
- Nginx
- 建议开放端口：`22`、`80`，有域名和 HTTPS 时再开放 `443`

## 首次部署

```bash
sudo apt update
sudo apt install -y git nginx nodejs npm
sudo npm install -g pm2

sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/yunqilu880-cyber/scoring-system.git
sudo chown -R $USER:$USER /var/www/scoring-system

cd /var/www/scoring-system
npm ci
npm run build
```

编辑 `deploy/ecosystem.config.cjs`，把 `ADMIN_PASSWORD` 改成正式强密码。系统首次启动后会把管理员密码加密保存到数据文件里，之后管理员也可以在网页后台的“修改密码”中自行修改。

```bash
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup
```

## Nginx

```bash
sudo cp deploy/nginx-scoring-system.conf /etc/nginx/sites-available/scoring-system
sudo ln -s /etc/nginx/sites-available/scoring-system /etc/nginx/sites-enabled/scoring-system
sudo nginx -t
sudo systemctl reload nginx
```

配置完成后访问：

```text
http://服务器IP/
```

## 正式使用流程

1. 管理员登录管理端。
2. 在“申报人数据”里新增或批量导入申报人。
3. 未激活用户会自动生成邀请码。
4. 用户打开网站，选择“邀请码激活”，输入用户编号、邀请码并设置密码。
5. 用户登录后选择评分项目，填写自评分并上传证明图片。
6. 管理员在“材料复评”中预览图片，通过、驳回或调整复评分。
7. “排名结果”自动统计分项复评分和总分，可导出 CSV，Excel 可以直接打开。
8. 管理员可在“评分规则”的“数据维护”里立即备份服务器数据。

## 重要配置

后台服务读取这些环境变量：

```bash
PORT=3000
DATA_DIR=/var/www/scoring-system/data
ADMIN_USERNAME=admin
ADMIN_PASSWORD=请改成强密码
COOKIE_SECURE=false
```

如果配置了 HTTPS，可以把 `COOKIE_SECURE` 改为 `true`。

## 数据位置和备份

默认数据目录：

```text
/var/www/scoring-system/data
```

其中：

- `data.json` 保存用户、邀请码、复评记录、申报批次和评分规则。
- `uploads/` 保存用户上传的证明图片。

建议定期备份：

```bash
cd /var/www/scoring-system
npm run backup:data -- manual
```

网页后台点击“立即备份”也会生成同样类型的备份目录。系统在导入备份或重置演示数据前，会自动先备份一次当前数据。

如果管理员忘记后台密码，可以登录服务器后执行：

```bash
cd /var/www/scoring-system
npm run reset:admin-password -- "新的强密码"
pm2 restart scoring-system
```

## 更新代码

```bash
cd /var/www/scoring-system
cp -a data data-backup-$(date +%F-%H%M)
git pull
npm ci
npm run build
pm2 restart scoring-system
pm2 save
```
