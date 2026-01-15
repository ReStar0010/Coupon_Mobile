from django.core.management.base import BaseCommand
from django.contrib.auth.models import Group, User


class Command(BaseCommand):
    help = '列出所有群組及其成員'

    def add_arguments(self, parser):
        parser.add_argument(
            '--group',
            type=str,
            help='指定要查看的群組名稱（可選）',
        )

    def handle(self, *args, **options):
        group_name = options.get('group')
        
        if group_name:
            # 只顯示指定群組
            try:
                group = Group.objects.get(name=group_name)
                self.print_group(group)
            except Group.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(f'群組 "{group_name}" 不存在')
                )
        else:
            # 顯示所有群組
            groups = Group.objects.all().order_by('name')
            
            if not groups.exists():
                self.stdout.write(self.style.WARNING('資料庫中沒有任何群組'))
                return
            
            self.stdout.write(self.style.SUCCESS(f'\n找到 {groups.count()} 個群組：\n'))
            self.stdout.write('=' * 80)
            
            for group in groups:
                self.print_group(group)
                self.stdout.write('=' * 80)
    
    def print_group(self, group):
        """打印單個群組的詳細資訊"""
        # 獲取群組的所有成員
        members = group.user_set.all().order_by('email')
        member_count = members.count()
        
        # 獲取群組的權限
        permissions = group.permissions.all().order_by('content_type__app_label', 'codename')
        permission_count = permissions.count()
        
        # 打印群組基本資訊
        self.stdout.write(self.style.SUCCESS(f'\n群組名稱: {group.name}'))
        self.stdout.write(f'群組 ID: {group.id}')
        self.stdout.write(f'成員數量: {member_count}')
        self.stdout.write(f'權限數量: {permission_count}')
        
        # 打印成員列表
        if member_count > 0:
            self.stdout.write(self.style.WARNING(f'\n成員列表 ({member_count} 人):'))
            self.stdout.write('-' * 80)
            for idx, user in enumerate(members, 1):
                # 獲取用戶的其他群組
                other_groups = user.groups.exclude(id=group.id).values_list('name', flat=True)
                other_groups_str = ', '.join(other_groups) if other_groups else '無'
                
                # 獲取用戶的個人權限（不屬於任何群組的權限）
                user_permissions = user.user_permissions.all()
                user_perms_str = f'{user_permissions.count()} 個個人權限' if user_permissions.exists() else '無個人權限'
                
                self.stdout.write(
                    f'  {idx}. {user.email} (ID: {user.id}, Username: {user.username})'
                )
                self.stdout.write(
                    f'     其他群組: {other_groups_str}'
                )
                self.stdout.write(
                    f'     個人權限: {user_perms_str}'
                )
                self.stdout.write(
                    f'     是否為員工: {user.is_staff}, 是否為超級用戶: {user.is_superuser}'
                )
                self.stdout.write('')
        else:
            self.stdout.write(self.style.WARNING('\n此群組目前沒有任何成員'))
        
        # 打印權限列表
        if permission_count > 0:
            self.stdout.write(self.style.WARNING(f'\n權限列表 ({permission_count} 個):'))
            self.stdout.write('-' * 80)
            
            # 按應用程式分組顯示權限
            current_app = None
            for permission in permissions:
                app_label = permission.content_type.app_label
                model_name = permission.content_type.model
                
                if current_app != app_label:
                    if current_app is not None:
                        self.stdout.write('')
                    self.stdout.write(self.style.SUCCESS(f'  [{app_label}]'))
                    current_app = app_label
                
                self.stdout.write(
                    f'    - {model_name}.{permission.codename} ({permission.name})'
                )
        else:
            self.stdout.write(self.style.WARNING('\n此群組目前沒有任何權限'))

